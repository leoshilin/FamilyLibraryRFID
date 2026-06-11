package com.hdhe.scantest;

import android.content.Context;
import android.content.Intent;

/**
 * @author Administrator
 * @date 2018/4/19
 */

public class ScanUtil {

    /**
     * Open scan service
     */
    private final String ACTION_SCAN_INIT = "com.rfid.SCAN_INIT";
    /**
     * Scanning
     */
    private final String ACTION_SCAN = "com.rfid.SCAN_CMD";
    /**
     * Stop Scanning
     */
    private static final String ACTION_STOP_SCAN = "com.rfid.STOP_SCAN";
    /**
     * Close scan service
     */
    private final String ACTION_CLOSE_SCAN = "com.rfid.CLOSE_SCAN";
    /**
     * Scan result output mode, 0 -- BroadcastReceiver mode; 1 -- Focus input mode (default)
     */
    private final String ACTION_SET_SCAN_MODE = "com.rfid.SET_SCAN_MODE";
    /**
     * Scan timeout (Value:1000,2000,3000,4000,5000,6000,7000,8000,9000,10000)
     */
    private final String ACTION_SCAN_TIME = "com.rfid.SCAN_TIME";

    private Context context;

    /**
     * Initialize ScanUtil and open scan service
     * @param context Context
     */
    ScanUtil(Context context) {
        this.context = context;
        Intent intent = new Intent();
        intent.setAction(ACTION_SCAN_INIT);
        context.sendBroadcast(intent);
    }

    /**
     * Start Scanning
     */
    public void scan() {
        Intent intent = new Intent();
        intent.setAction(ACTION_SCAN);
        context.sendBroadcast(intent);
    }

    /**
     * Stop Scanning
     */
    public void stopScan() {
        Intent intent = new Intent();
        intent.setAction(ACTION_STOP_SCAN);
        context.sendBroadcast(intent);
    }

    /**
     * Set the scan result output mode
     * @param mode 0 -- BroadcastReceiver mode; 1 -- Focus input mode (default)
     */
    public void setScanMode(int mode) {
        Intent intent = new Intent();
        intent.setAction(ACTION_SET_SCAN_MODE);
        intent.putExtra("mode", mode);
        context.sendBroadcast(intent);
    }

    /**
     * Close scan service
     */
    public void close() {
        Intent toKillService = new Intent();
//        toKillService.putExtra("iscamera", true);
        toKillService.setAction(ACTION_CLOSE_SCAN);
        context.sendBroadcast(toKillService);
    }

    /**
     * Set scan timeout
     * @param timeout Value:1000,2000,3000,4000,5000(default),6000,7000,8000,9000,10000
     */
    public void setTimeout(String timeout){
        Intent intent = new Intent();
        intent.setAction(ACTION_SCAN_TIME);
        intent.putExtra("time", timeout);
        context.sendBroadcast(intent);
    }
}
