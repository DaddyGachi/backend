import { PrismaClient } from '@prisma/client';
import { BaseService } from '../../services/base.service';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class AnalyticsService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super();
  }

  /**
   * Get earnings over time for a creator
   */
  async getEarningsOverTime(
    creatorId: string,
    days = 30
  ): Promise<{
    date: string;
    earnings: number;
    tipCount: number;
  }[]> {
    return this.executeWithLogging('analytics.earningsOverTime', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const tips = await this.prisma.tip.findMany({
        where: {
          creatorId,
          status: 'confirmed',
          createdAt: { gte: startDate },
        },
        select: {
          amount: true,
          createdAt: true,
        },
      });

      // Group by date
      const groupedByDate: Record<string, { earnings: number; count: number }> = {};

      for (const tip of tips) {
        const date = tip.createdAt.toISOString().split('T')[0];
        if (!groupedByDate[date]) {
          groupedByDate[date] = { earnings: 0, count: 0 };
        }
        groupedByDate[date].earnings += tip.amount;
        groupedByDate[date].count += 1;
      }

      // Convert to array and sort by date
      return Object.entries(groupedByDate)
        .map(([date, data]) => ({
          date,
          earnings: data.earnings,
          tipCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  /**
   * Get top supporters for a creator
   */
  async getTopSupporters(
    creatorId: string,
    limit = 10
  ): Promise<{
    userId: string;
    totalAmount: number;
    tipCount: number;
    lastTipDate: string;
  }[]> {
    return this.executeWithLogging('analytics.topSupporters', async () => {
      const supporters = await this.prisma.tip.groupBy({
        by: ['fromUserId'],
        where: {
          creatorId,
          status: 'confirmed',
        },
        _sum: { amount: true },
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: [{ _sum: { amount: 'desc' } }],
        take: limit,
      });

      return supporters.map((supporter) => ({
        userId: supporter.fromUserId,
        totalAmount: supporter._sum.amount || 0,
        tipCount: supporter._count.id,
        lastTipDate: (supporter._max.createdAt || new Date()).toISOString(),
      }));
    });
  }

  /**
   * Get tip frequency statistics
   */
  async getTipFrequency(
    creatorId: string,
    days = 30
  ): Promise<{
    totalTips: number;
    averageTipAmount: number;
    largestTip: number;
    smallestTip: number;
    tipsPerDay: number;
    totalEarnings: number;
  }> {
    return this.executeWithLogging('analytics.tipFrequency', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const tips = await this.prisma.tip.findMany({
        where: {
          creatorId,
          status: 'confirmed',
          createdAt: { gte: startDate },
        },
        select: {
          amount: true,
        },
      });

      if (tips.length === 0) {
        return {
          totalTips: 0,
          averageTipAmount: 0,
          largestTip: 0,
          smallestTip: 0,
          tipsPerDay: 0,
          totalEarnings: 0,
        };
      }

      const totalEarnings = tips.reduce((sum, tip) => sum + tip.amount, 0);
      const averageTipAmount = totalEarnings / tips.length;
      const largestTip = Math.max(...tips.map((t) => t.amount));
      const smallestTip = Math.min(...tips.map((t) => t.amount));
      const tipsPerDay = tips.length / days;

      return {
        totalTips: tips.length,
        averageTipAmount: Math.round(averageTipAmount * 100) / 100,
        largestTip,
        smallestTip,
        tipsPerDay: Math.round(tipsPerDay * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      };
    });
  }

  /**
   * Get summary stats for a creator
   */
  async getSummaryStats(creatorId: string): Promise<{
    totalEarnings: number;
    totalTips: number;
    uniqueSupporters: number;
    averageTipAmount: number;
  }> {
    return this.executeWithLogging('analytics.summary', async () => {
      const [totalTips, stats] = await Promise.all([
        this.prisma.tip.count({
          where: {
            creatorId,
            status: 'confirmed',
          },
        }),
        this.prisma.tip.groupBy({
          by: [],
          where: {
            creatorId,
            status: 'confirmed',
          },
          _sum: { amount: true },
          _count: { fromUserId: true },
        }),
      ]);

      const uniqueSupporters = await this.prisma.tip.findMany({
        where: {
          creatorId,
          status: 'confirmed',
        },
        distinct: ['fromUserId'],
        select: { fromUserId: true },
      });

      const totalEarnings = stats[0]?._sum?.amount || 0;
      const averageTipAmount = totalTips > 0 ? totalEarnings / totalTips : 0;

      return {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalTips,
        uniqueSupporters: uniqueSupporters.length,
        averageTipAmount: Math.round(averageTipAmount * 100) / 100,
      };
    });
  }
}
