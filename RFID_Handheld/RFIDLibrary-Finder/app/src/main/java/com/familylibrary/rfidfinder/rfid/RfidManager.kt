package com.familylibrary.rfidfinder.rfid

import com.handheld.uhfr.UHFRManager
import com.uhf.api.cls.Reader

/**
 * 厂家 RFID SDK（UHFRManager）的封装层（Wrapper）。
 *
 * 设计约束（见 .codex/AI_PROJECT_GUIDE.md §9 厂家 SDK）：
 * SDK 视为第三方代码，不得修改；需要扩展时新增 Wrapper。
 * 本类统一封装初始化与常用读写操作，业务层只依赖 [RfidManager] 与 [RfidTag]，
 * 不直接接触 SDK 类型，便于后续替换或单元测试。
 *
 * SDK 方法签名依据 jar 反编译确认：
 * - getInstance(): UHFRManager
 * - tagEpcTidInventoryByTimer(short): List<Reader.TAGINFO>?
 * - tagInventoryByTimer(short): List<Reader.TAGINFO>?
 * - setPower(int,int): Reader.READER_ERR
 * - getPower(): int[]
 * - writeTagEPCByFilter(byte[],byte[],short,byte[],int,int,boolean): Reader.READER_ERR
 * - setInventoryFilter(byte[],int,int,boolean): boolean
 * - setCancleInventoryFilter(): boolean
 * Reader.TAGINFO 字段：EpcId(byte[]) / EmbededData(byte[],即 TID) / RSSI(int)
 */
object RfidManager {

    // SDK 实例（懒初始化：首次 init 时调用 getInstance）
    private var manager: UHFRManager? = null

    /** 最低读功率（dBm），初始化后默认使用。 */
    const val MIN_READ_POWER = 5

    /** 最低写功率（dBm），初始化后默认使用。 */
    const val MIN_WRITE_POWER = 5

    /**
     * 初始化/获取 SDK 实例，并自动将读写功率设为最低档。
     * 必须在 PDA 真机调用（依赖 jniLibs 中的 so）；模拟器/非 PDA 设备会失败。
     * @return 是否初始化成功
     */
    fun init(): Boolean = runCatching {
        manager = UHFRManager.getInstance()
        if (manager != null) {
            // 初始化后立即将功率设为最低档，减少功耗和误读范围
            setPower(MIN_READ_POWER, MIN_WRITE_POWER)
        }
        manager != null
    }.getOrDefault(false)

    /** 是否已初始化（init 成功且实例非空）。 */
    fun isReady(): Boolean = manager != null

    /**
     * 单次盘点：读取 timeoutMs 内所有可见标签的 EPC+TID+RSSI。
     * @param timeoutMs 盘点时长(ms)，对应 SDK 的 short 参数，常用 50~100
     * @return 标签列表（可能为空）；SDK 未初始化或异常时抛 [RfidException]
     */
    fun inventory(timeoutMs: Int = 50): List<RfidTag> {
        val m = manager ?: throw RfidException.NotInitialized
        return runCatching {
            m.tagEpcTidInventoryByTimer(timeoutMs.toShort())
                ?.map { it.toRfidTag() }
                .orEmpty()
        }.getOrElse { throw RfidException.ReadFailed(it) }
    }

    /**
     * 设置读写功率（dBm，约 5~30，依设备而定）。
     * @param readPower 读功率
     * @param writePower 写功率
     * @return 是否设置成功
     */
    fun setPower(readPower: Int, writePower: Int): Boolean {
        val m = manager ?: throw RfidException.NotInitialized
        return runCatching {
            m.setPower(readPower, writePower) == Reader.READER_ERR.MT_OK_ERR
        }.getOrElse { throw RfidException.WriteFailed(it) }
    }

    /** 读取当前读写功率，返回 [读功率, 写功率]；未取到返回 null。 */
    fun getPower(): Pair<Int, Int>? {
        val m = manager ?: throw RfidException.NotInitialized
        return runCatching {
            m.getPower()?.let { arr ->
                if (arr.isEmpty()) null else arr[0] to if (arr.size > 1) arr[1] else arr[0]
            }
        }.getOrElse { throw RfidException.ReadFailed(it) }
    }

    /**
     * 按 TID 过滤写入 EPC（绑定流程 F4.3：把 EPC 区写为 book_item_id）。
     * 写入后回读校验，确保落盘成功。
     * @param tid 目标标签 TID（十六进制串，如 "E200001722110208"）
     * @param newEpc 待写入 EPC（十六进制串，长度需符合标签 EPC 区）
     * @param timeoutMs 写操作超时(ms)
     * @return 是否写入并校验成功
     */
    fun writeEpcByTid(tid: String, newEpc: String, timeoutMs: Int = 1000): Boolean {
        val m = manager ?: throw RfidException.NotInitialized
        return runCatching {
            val err = m.writeTagEPCByFilter(
                HexUtils.hexToBytes(newEpc),
                HexUtils.hexToBytes("00000000"),
                timeoutMs.toShort(),
                HexUtils.hexToBytes(tid),
                2, // bank: TID
                0, // offset
                true
            )
            val writeOk = err == Reader.READER_ERR.MT_OK_ERR
            // 回读校验：按 TID 过滤盘点，比对 EPC
            m.setInventoryFilter(HexUtils.hexToBytes(tid), 2, 0, true)
            val verifyEpc = m.tagInventoryByTimer(50.toShort())
                ?.firstOrNull()
                ?.let { HexUtils.bytesToHex(it.EpcId) }
            m.setCancleInventoryFilter()
            writeOk && verifyEpc.equals(newEpc, ignoreCase = true)
        }.getOrElse { throw RfidException.WriteFailed(it) }
    }

    /**
     * 按 TID 过滤盘点（盖革寻书模式 F6.2）：仅返回匹配目标 TID 的标签及其 RSSI。
     * @param tid 目标 TID（十六进制串）
     * @param timeoutMs 盘点时长(ms)
     * @return 匹配到的标签（含 RSSI），无则返回 null
     */
    fun findTagByTid(tid: String, timeoutMs: Int = 100): RfidTag? {
        val m = manager ?: throw RfidException.NotInitialized
        return runCatching {
            m.setInventoryFilter(HexUtils.hexToBytes(tid), 2, 0, true)
            val tag = m.tagInventoryByTimer(timeoutMs.toShort())?.firstOrNull()?.toRfidTag()
            m.setCancleInventoryFilter()
            tag
        }.getOrElse { throw RfidException.ReadFailed(it) }
    }

    /** 将 SDK 标签对象转为内部 [RfidTag]（不向外暴露 SDK 类型）。 */
    private fun Reader.TAGINFO.toRfidTag(): RfidTag = RfidTag(
        epc = HexUtils.bytesToHex(EpcId),
        tid = HexUtils.bytesToHex(EmbededData),
        rssi = RSSI
    )
}
