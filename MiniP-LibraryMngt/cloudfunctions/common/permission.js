const ACTIONS = {
  FAMILY_CREATE: 'FAMILY_CREATE',
  FAMILY_UPDATE: 'FAMILY_UPDATE',
  FAMILY_DELETE: 'FAMILY_DELETE',

  BOOKSHELF_CREATE: 'BOOKSHELF_CREATE',
  BOOKSHELF_UPDATE: 'BOOKSHELF_UPDATE',
  BOOKSHELF_DELETE: 'BOOKSHELF_DELETE',
  BOOKSHELF_LIST: 'BOOKSHELF_LIST',

  BOOKITEM_CREATE: 'BOOKITEM_CREATE',
  BOOKITEM_OFFSTOCK: 'BOOKITEM_OFFSTOCK',
  BOOKITEM_RESTOCK: 'BOOKITEM_RESTOCK',
  BOOKITEM_DELETE: 'BOOKITEM_DELETE',
  BOOKITEM_SEARCH: 'BOOKITEM_SEARCH',
  RECENTBOOK_SEARCH: 'RECENTBOOK_SEARCH',

  COVER_UPDATE: 'COVER_UPDATE',

  RFID_TASK_CREATE_BIND: 'RFID_TASK_CREATE_BIND',
  RFID_UNBIND: 'RFID_UNBIND',
  RFID_TASK_CREATE_FIND: 'RFID_TASK_CREATE_FIND'
}

const RESOURCE_TYPES = {
  FAMILY: 'family',
  BOOKSHELF: 'bookshelf',
  BOOK_ITEM: 'book_item'
}

const FAMILY_CREATE_ACTIONS = [
  ACTIONS.FAMILY_CREATE
]

const ROLE_PERMISSION = {
  OWNER: [
    ACTIONS.FAMILY_UPDATE,
    ACTIONS.FAMILY_DELETE,
    ACTIONS.BOOKSHELF_CREATE,
    ACTIONS.BOOKSHELF_UPDATE,
    ACTIONS.BOOKSHELF_DELETE,
    ACTIONS.BOOKSHELF_LIST,
    ACTIONS.BOOKITEM_CREATE,
    ACTIONS.COVER_UPDATE,
    ACTIONS.BOOKITEM_OFFSTOCK,
    ACTIONS.BOOKITEM_RESTOCK,
    ACTIONS.BOOKITEM_DELETE,
    ACTIONS.BOOKITEM_SEARCH,
    ACTIONS.RECENTBOOK_SEARCH,
    ACTIONS.RFID_TASK_CREATE_BIND,
    ACTIONS.RFID_UNBIND,
    ACTIONS.RFID_TASK_CREATE_FIND
  ],

  MEMBER: [
    ACTIONS.BOOKSHELF_LIST,
    ACTIONS.BOOKITEM_CREATE,
    ACTIONS.COVER_UPDATE,
    ACTIONS.BOOKITEM_OFFSTOCK,
    ACTIONS.BOOKITEM_RESTOCK,
    ACTIONS.BOOKITEM_SEARCH,
    ACTIONS.RECENTBOOK_SEARCH,
    ACTIONS.RFID_TASK_CREATE_BIND,
    ACTIONS.RFID_TASK_CREATE_FIND
  ],

  GUEST: [
    ACTIONS.BOOKSHELF_LIST,
    ACTIONS.BOOKITEM_SEARCH,
    ACTIONS.RECENTBOOK_SEARCH
  ]
}

const FRONTEND_PERMISSION_KEYS = {
  canUpdateFamily: ACTIONS.FAMILY_UPDATE,
  canDeleteFamily: ACTIONS.FAMILY_DELETE,
  canCreateBookshelf: ACTIONS.BOOKSHELF_CREATE,
  canUpdateBookshelf: ACTIONS.BOOKSHELF_UPDATE,
  canDeleteBookshelf: ACTIONS.BOOKSHELF_DELETE,
  canListBookshelf: ACTIONS.BOOKSHELF_LIST,
  canCreateBookItem: ACTIONS.BOOKITEM_CREATE,
  canOffstockBookItem: ACTIONS.BOOKITEM_OFFSTOCK,
  canRestockBookItem: ACTIONS.BOOKITEM_RESTOCK,
  canDeleteBookItem: ACTIONS.BOOKITEM_DELETE,
  canSearchBook: ACTIONS.BOOKITEM_SEARCH,
  canViewRecentBook: ACTIONS.RECENTBOOK_SEARCH,
  canUpdateCover: ACTIONS.COVER_UPDATE,
  canCreateBindRfidTask: ACTIONS.RFID_TASK_CREATE_BIND,
  canUnbindRfid: ACTIONS.RFID_UNBIND,
  canCreateFindBookTask: ACTIONS.RFID_TASK_CREATE_FIND
}

const getCurrentUser = async (db, openid) => {

  if (!openid) {
    return null
  }

  const userRes = await db
    .collection('user')
    .where({
      openid
    })
    .limit(1)
    .get()

  return userRes.data[0] || null

}

const resolveFamilyId = async ({
  db,
  familyId,
  resourceType,
  resourceId
}) => {

  if (familyId) {
    return familyId
  }

  if (!resourceType || !resourceId) {
    return ''
  }

  if (resourceType === RESOURCE_TYPES.FAMILY) {
    return resourceId
  }

  if (resourceType === RESOURCE_TYPES.BOOKSHELF) {

    const bookshelfRes = await db
      .collection('bookshelf')
      .doc(resourceId)
      .get()

    return bookshelfRes.data?.familyId || ''

  }

  if (resourceType === RESOURCE_TYPES.BOOK_ITEM) {

    const bookItemRes = await db
      .collection('book_item')
      .doc(resourceId)
      .get()

    return bookItemRes.data?.family_id || ''

  }

  return ''

}

const getFamilyRole = async (db, userId, familyId) => {

  if (!userId || !familyId) {
    return null
  }

  const userFamilyRes = await db
    .collection('user_family')
    .where({
      userId,
      familyId
    })
    .limit(1)
    .get()

  return userFamilyRes.data[0]?.role || null

}

const isActionAllowedForRole = (action, familyRole) => {

  const permissions = ROLE_PERMISSION[familyRole] || []

  return permissions.includes(action)

}

const buildPermissions = ({
  systemRole,
  familyRole
}) => {

  const permissions = {}

  Object.keys(FRONTEND_PERMISSION_KEYS).forEach((key) => {

    const action = FRONTEND_PERMISSION_KEYS[key]

    permissions[key] =
      systemRole === 'ADMIN' ||
      isActionAllowedForRole(action, familyRole)

  })

  return permissions

}

const checkPermission = async ({
  db,
  openid,
  action,
  familyId,
  resourceType,
  resourceId
}) => {

  if (!db) {
    return {
      allowed: false,
      message: '缺少数据库对象'
    }
  }

  if (!action) {
    return {
      allowed: false,
      message: '缺少权限动作'
    }
  }

  const user = await getCurrentUser(db, openid)

  if (!user) {
    return {
      allowed: false,
      message: '用户未注册'
    }
  }

  if (user.status !== 'ACTIVE') {
    return {
      allowed: false,
      user,
      message: '用户状态不可用'
    }
  }

  if (user.role === 'ADMIN') {
    return {
      allowed: true,
      user,
      systemRole: user.role,
      familyRole: null,
      familyId: familyId || ''
    }
  }

  // 创建家庭是注册用户权限，不依赖 user_family。
  if (FAMILY_CREATE_ACTIONS.includes(action)) {
    return {
      allowed: true,
      user,
      systemRole: user.role,
      familyRole: null,
      familyId: ''
    }
  }

  const resolvedFamilyId = await resolveFamilyId({
    db,
    familyId,
    resourceType,
    resourceId
  })

  if (!resolvedFamilyId) {
    return {
      allowed: false,
      user,
      message: '缺少家庭ID'
    }
  }

  const familyRole = await getFamilyRole(
    db,
    user._id,
    resolvedFamilyId
  )

  if (!familyRole) {
    return {
      allowed: false,
      user,
      familyId: resolvedFamilyId,
      message: '用户不属于该家庭'
    }
  }

  if (!isActionAllowedForRole(action, familyRole)) {
    return {
      allowed: false,
      user,
      systemRole: user.role,
      familyRole,
      familyId: resolvedFamilyId,
      message: '无权限操作'
    }
  }

  return {
    allowed: true,
    user,
    systemRole: user.role,
    familyRole,
    familyId: resolvedFamilyId
  }

}

module.exports = {
  ACTIONS,
  RESOURCE_TYPES,
  ROLE_PERMISSION,
  FRONTEND_PERMISSION_KEYS,
  getCurrentUser,
  resolveFamilyId,
  getFamilyRole,
  isActionAllowedForRole,
  buildPermissions,
  checkPermission
}
