package com.familylibrary.rfidfinder.rfid

/**
 * RFID 标签的内部表示（与厂家 SDK 类型解耦）。
 *
 * 字段约定（见 Docs/家庭图书管理系统数据库表结构设计.md §3.x book_item）：
 * @param epc  标签 EPC 区数据（十六进制串）。绑定流程 F4.3 中会被写为 book_item 的 _id（book_item_id）。
 * @param tid  标签 TID（固化唯一值，十六进制串）。绑定后写入 book_item.rfid_tid。
 * @param rssi 信号强度（负数，dBm 量级）。绝对值越小（越接近 0）表示距离越近。
 */
data class RfidTag(
    val epc: String = "",
    val tid: String = "",
    val rssi: Int = 0
)
