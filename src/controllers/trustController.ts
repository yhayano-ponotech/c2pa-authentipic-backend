import { Request, Response } from 'express';
import { getTrustListStatus, updateTrustLists as updateLists } from '../services/trustListService';
import { config } from '../config';

/**
 * 証明書トラストリストの状態を取得
 */
export const getTrustStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await getTrustListStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting trust list status:', error);
    
    res.status(500).json({
      success: false,
      error: "トラストリストの状態取得中にエラーが発生しました。"
    });
  }
};

/**
 * 証明書トラストリストを手動で更新（管理者用）
 */
export const updateTrustLists = async (req: Request, res: Response): Promise<void> => {
  try {
    // 管理者権限チェック
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
      res.status(403).json({
        success: false,
        error: "このアクションには管理者権限が必要です。"
      });
      return;
    }
    
    if (!config.c2pa.trust.enabled) {
      res.status(400).json({
        success: false,
        error: "トラストリスト検証機能が無効になっています。"
      });
      return;
    }
    
    // トラストリストの更新
    const updated = await updateLists();
    
    if (updated) {
      const status = await getTrustListStatus();
      
      res.json({
        success: true,
        message: "トラストリストを正常に更新しました。",
        status
      });
    } else {
      res.status(500).json({
        success: false,
        error: "トラストリストの更新に失敗しました。"
      });
    }
  } catch (error) {
    console.error('Error updating trust lists:', error);
    
    res.status(500).json({
      success: false,
      error: "トラストリストの更新中にエラーが発生しました。"
    });
  }
};