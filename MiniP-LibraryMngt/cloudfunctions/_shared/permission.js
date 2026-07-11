const PERMISSIONS  = Object.freeze({
  FAMILY_CREATE: 'FAMILY_CREATE',
  FAMILY_UPDATE: 'FAMILY_UPDATE',
  FAMILY_DELETE: 'FAMILY_DELETE',

  BOOKSHELF_CREATE: 'BOOKSHELF_CREATE',
  BOOKSHELF_UPDATE: 'BOOKSHELF_UPDATE',
  BOOKSHELF_DELETE: 'BOOKSHELF_DELETE',
  BOOKSHELF_LIST: 'BOOKSHELF_LIST',

  BOOKITEM_CREATE: 'BOOKITEM_CREATE',
  BOOKITEM_UPDATE: 'BOOKITEM_UPDATE',
  BOOKITEM_OFFSTOCK: 'BOOKITEM_OFFSTOCK',
  BOOKITEM_RESTOCK: 'BOOKITEM_RESTOCK',
  BOOKITEM_DELETE: 'BOOKITEM_DELETE',
  BOOKITEM_SEARCH: 'BOOKITEM_SEARCH',
  RECENTBOOK_SEARCH: 'RECENTBOOK_SEARCH',

  COVER_UPDATE: 'COVER_UPDATE',

  RFID_TASK_CREATE_BIND: 'RFID_TASK_CREATE_BIND',
  RFID_UNBIND: 'RFID_UNBIND',
  RFID_TASK_CREATE_FIND: 'RFID_TASK_CREATE_FIND'
})

const RESOURCE_TYPES = Object.freeze({
  FAMILY: 'family',
  BOOKSHELF: 'bookshelf',
  BOOK_ITEM: 'book_item'
})

//不依赖家庭角色(user_family)即可拥有的权限
const PUBLIC_PERMISSIONS  = Object.freeze([
  PERMISSIONS.FAMILY_CREATE
])

const ROLE_PERMISSION = {
  OWNER: new Set([
    PERMISSIONS.FAMILY_UPDATE,
    PERMISSIONS.FAMILY_DELETE,
    PERMISSIONS.BOOKSHELF_CREATE,
    PERMISSIONS.BOOKSHELF_UPDATE,
    PERMISSIONS.BOOKSHELF_DELETE,
    PERMISSIONS.BOOKSHELF_LIST,
    PERMISSIONS.BOOKITEM_CREATE,
    PERMISSIONS.BOOKITEM_UPDATE,
    PERMISSIONS.COVER_UPDATE,
    PERMISSIONS.BOOKITEM_OFFSTOCK,
    PERMISSIONS.BOOKITEM_RESTOCK,
    PERMISSIONS.BOOKITEM_DELETE,
    PERMISSIONS.BOOKITEM_SEARCH,
    PERMISSIONS.RECENTBOOK_SEARCH,
    PERMISSIONS.RFID_TASK_CREATE_BIND,
    PERMISSIONS.RFID_UNBIND,
    PERMISSIONS.RFID_TASK_CREATE_FIND
  ]),

  MEMBER: new Set([
    PERMISSIONS.BOOKSHELF_CREATE,
    PERMISSIONS.BOOKSHELF_UPDATE,
    PERMISSIONS.BOOKSHELF_DELETE,    
    PERMISSIONS.BOOKSHELF_LIST,
    PERMISSIONS.BOOKITEM_CREATE,
    PERMISSIONS.BOOKITEM_UPDATE,
    PERMISSIONS.COVER_UPDATE,
    PERMISSIONS.BOOKITEM_OFFSTOCK,
    PERMISSIONS.BOOKITEM_RESTOCK,
    PERMISSIONS.BOOKITEM_SEARCH,
    PERMISSIONS.RECENTBOOK_SEARCH,
    PERMISSIONS.RFID_TASK_CREATE_BIND,
    PERMISSIONS.RFID_TASK_CREATE_FIND
  ]),

  GUEST: new Set([
    PERMISSIONS.BOOKSHELF_LIST,
    PERMISSIONS.BOOKITEM_SEARCH,
    PERMISSIONS.RECENTBOOK_SEARCH
  ])
}

const FRONTEND_PERMISSION_KEYS = {
  canCreateFamily: PERMISSIONS.FAMILY_CREATE,
  canUpdateFamily: PERMISSIONS.FAMILY_UPDATE,
  canDeleteFamily: PERMISSIONS.FAMILY_DELETE,
  canCreateBookshelf: PERMISSIONS.BOOKSHELF_CREATE,
  canUpdateBookshelf: PERMISSIONS.BOOKSHELF_UPDATE,
  canDeleteBookshelf: PERMISSIONS.BOOKSHELF_DELETE,
  canListBookshelf: PERMISSIONS.BOOKSHELF_LIST,
  canCreateBookItem: PERMISSIONS.BOOKITEM_CREATE,
  canUpdateBookItem: PERMISSIONS.BOOKITEM_UPDATE,
  canOffstockBookItem: PERMISSIONS.BOOKITEM_OFFSTOCK,
  canRestockBookItem: PERMISSIONS.BOOKITEM_RESTOCK,
  canDeleteBookItem: PERMISSIONS.BOOKITEM_DELETE,
  canSearchBook: PERMISSIONS.BOOKITEM_SEARCH,
  canViewRecentBook: PERMISSIONS.RECENTBOOK_SEARCH,
  canUpdateCover: PERMISSIONS.COVER_UPDATE,
  canCreateBindRfidTask: PERMISSIONS.RFID_TASK_CREATE_BIND,
  canUnbindRfid: PERMISSIONS.RFID_UNBIND,
  canCreateFindBookTask: PERMISSIONS.RFID_TASK_CREATE_FIND
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

    return bookshelfRes.data?.family_id || ''

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
      user_id: userId,
      family_id: familyId
    })
    .limit(1)
    .get()

  return userFamilyRes.data[0]?.role || null

}

//根据家庭角色判断是否拥有指定权限

const hasPermission = (permission, familyRole) => {

  const permissions = ROLE_PERMISSION[familyRole] || new Set()

  return permissions.has(permission)

}

const buildPermissions = ({
  systemRole,
  familyRole
}) => {

  const permissions = {}

  Object.keys(FRONTEND_PERMISSION_KEYS).forEach((key) => {

      const permission = FRONTEND_PERMISSION_KEYS[key]

      permissions[key] =
        systemRole === 'ADMIN' ||
        hasPermission(permission, familyRole)

      })

  return permissions

}

// 为已登录用户构建当前家庭下的完整权限集
// 供 api_user_login 等需要返回前端权限的场景使用
const buildFamilyPermissions = async (db, user) => {

  const permissions = {}

  // 系统管理员拥有所有权限
  if (user.role === 'ADMIN') {

    Object.keys(FRONTEND_PERMISSION_KEYS).forEach((key) => {
      permissions[key] = true
    })

    return permissions

  }

  // 注册用户即可创建家庭，无需依赖家庭角色
  permissions.canCreateFamily = true

  // 如果用户有当前家庭，查询家庭角色并构建该家庭下的权限
  if (user.current_family_id) {

    const familyRole = await getFamilyRole(
      db,
      user._id,
      user.current_family_id
    )

    if (familyRole) {

      Object.keys(FRONTEND_PERMISSION_KEYS).forEach((key) => {

        // canCreateFamily 已在上面处理，跳过
        if (key === 'canCreateFamily') {
          return
        }

        const permission = FRONTEND_PERMISSION_KEYS[key]

        permissions[key] = hasPermission(permission, familyRole)

      })

    }

  }

  return permissions

}

const checkPermission = async ({
  db,
  openid,
  permission,
  familyId,
  resourceType,
  resourceId
}) => {

  if (!db) {
    return {
      allowed: false,
      reason: 'MISSING_DB',
      message: '缺少数据库对象'
    }
  }

  if (!permission) {
    return {
      allowed: false,
      reason: 'MISSING_PERMISSION',
      message: '缺少权限定义'
    }
  }

  const user = await getCurrentUser(db, openid)

  if (!user) {
    return {
      allowed: false,
      reason: 'USER_NOT_FOUND',
      message: '用户未注册'
    }
  }

  if (user.status !== 'ACTIVE') {
    return {
      allowed: false,
      reason: 'USER_DISABLED',
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
  if (PUBLIC_PERMISSIONS.includes(permission)) {
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
      reason: 'MISSING_FAMILY_ID',
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
      reason: 'NOT_FAMILY_MEMBER',
      user,
      familyId: resolvedFamilyId,
      message: '用户不属于该家庭'
    }
  }

  if (!hasPermission(permission, familyRole)) {
    return {
      allowed: false,
      reason: 'PERMISSION_DENIED',
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
  PERMISSIONS,
  RESOURCE_TYPES,
  ROLE_PERMISSION,
  FRONTEND_PERMISSION_KEYS,
  getCurrentUser,
  resolveFamilyId,
  getFamilyRole,
  hasPermission,
  buildPermissions,
  buildFamilyPermissions,
  checkPermission
}
