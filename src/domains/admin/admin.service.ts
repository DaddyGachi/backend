import { PrismaClient } from '@prisma/client';
import { BaseService } from '../../services/base.service';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export interface FlagWalletRequest {
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
}

export interface FreezeAccountRequest {
  reason: string;
  duration?: number; // In hours, null = indefinite
  notes?: string;
}

export class AdminService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super();
  }

  /**
   * Check if user is admin
   */
  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }

  /**
   * Flag a wallet as suspicious
   */
  async flagWallet(adminUserId: string, walletAddress: string, data: FlagWalletRequest): Promise<{
    id: string;
    walletAddress: string;
    flaggedAt: string;
    reason: string;
    severity: string;
    status: string;
  }> {
    return this.executeWithLogging('admin.flagWallet', async () => {
      if (!(await this.isAdmin(adminUserId))) {
        throw new UnauthorizedError('Only admins can flag wallets');
      }

      // Find wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { address: walletAddress },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet');
      }

      // Create wallet flag
      const flag = await this.prisma.walletFlag.create({
        data: {
          walletId: wallet.id,
          reason: data.reason,
          severity: data.severity,
          notes: data.notes,
          flaggedBy: adminUserId,
          status: 'active',
        },
      });

      logger.warn(`Wallet flagged by admin: ${walletAddress} (severity: ${data.severity})`);

      return {
        id: flag.id,
        walletAddress,
        flaggedAt: flag.createdAt.toISOString(),
        reason: flag.reason,
        severity: flag.severity,
        status: flag.status,
      };
    });
  }

  /**
   * Unflag a wallet
   */
  async unflagWallet(adminUserId: string, flagId: string): Promise<void> {
    return this.executeWithLogging('admin.unflagWallet', async () => {
      if (!(await this.isAdmin(adminUserId))) {
        throw new UnauthorizedError('Only admins can unflag wallets');
      }

      const flag = await this.prisma.walletFlag.findUnique({
        where: { id: flagId },
      });

      if (!flag) {
        throw new NotFoundError('Wallet flag');
      }

      await this.prisma.walletFlag.update({
        where: { id: flagId },
        data: { status: 'resolved' },
      });

      logger.info(`Wallet flag resolved by admin: ${flagId}`);
    });
  }

  /**
   * Freeze a creator account pending review
   */
  async freezeAccount(
    adminUserId: string,
    creatorId: string,
    data: FreezeAccountRequest
  ): Promise<{
    id: string;
    creatorId: string;
    frozenAt: string;
    reason: string;
    unfreezesAt?: string;
    status: string;
  }> {
    return this.executeWithLogging('admin.freezeAccount', async () => {
      if (!(await this.isAdmin(adminUserId))) {
        throw new UnauthorizedError('Only admins can freeze accounts');
      }

      const creator = await this.prisma.creator.findUnique({
        where: { id: creatorId },
      });

      if (!creator) {
        throw new NotFoundError('Creator');
      }

      // Calculate unfreeze time if duration provided
      let unfreezesAt = null;
      if (data.duration) {
        unfreezesAt = new Date();
        unfreezesAt.setHours(unfreezesAt.getHours() + data.duration);
      }

      // Create freeze record
      const freeze = await this.prisma.accountFreeze.create({
        data: {
          creatorId,
          reason: data.reason,
          unfreezesAt,
          notes: data.notes,
          frozenBy: adminUserId,
          status: 'active',
        },
      });

      // Mark creator as frozen
      await this.prisma.creator.update({
        where: { id: creatorId },
        data: { frozen: true },
      });

      logger.warn(`Creator account frozen by admin: ${creatorId} (reason: ${data.reason})`);

      return {
        id: freeze.id,
        creatorId,
        frozenAt: freeze.createdAt.toISOString(),
        reason: freeze.reason,
        unfreezesAt: unfreezesAt?.toISOString(),
        status: freeze.status,
      };
    });
  }

  /**
   * Unfreeze a creator account
   */
  async unfreezeAccount(adminUserId: string, freezeId: string): Promise<void> {
    return this.executeWithLogging('admin.unfreezeAccount', async () => {
      if (!(await this.isAdmin(adminUserId))) {
        throw new UnauthorizedError('Only admins can unfreeze accounts');
      }

      const freeze = await this.prisma.accountFreeze.findUnique({
        where: { id: freezeId },
        include: { creator: true },
      });

      if (!freeze) {
        throw new NotFoundError('Account freeze');
      }

      await this.prisma.accountFreeze.update({
        where: { id: freezeId },
        data: { status: 'resolved' },
      });

      // Unfreeze creator
      await this.prisma.creator.update({
        where: { id: freeze.creatorId },
        data: { frozen: false },
      });

      logger.info(`Creator account unfrozen by admin: ${freeze.creatorId}`);
    });
  }

  /**
   * Get moderation queue - flagged wallets and frozen accounts
   */
  async getModerationQueue(): Promise<{
    flaggedWallets: {
      id: string;
      walletAddress: string;
      severity: string;
      reason: string;
      flaggedAt: string;
    }[];
    frozenAccounts: {
      id: string;
      creatorId: string;
      reason: string;
      frozenAt: string;
      unfreezesAt?: string;
    }[];
  }> {
    return this.executeWithLogging('admin.moderationQueue', async () => {
      const [flaggedWallets, frozenAccounts] = await Promise.all([
        this.prisma.walletFlag.findMany({
          where: { status: 'active' },
          include: { wallet: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.accountFreeze.findMany({
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        flaggedWallets: flaggedWallets.map((f) => ({
          id: f.id,
          walletAddress: f.wallet.address,
          severity: f.severity,
          reason: f.reason,
          flaggedAt: f.createdAt.toISOString(),
        })),
        frozenAccounts: frozenAccounts.map((f) => ({
          id: f.id,
          creatorId: f.creatorId,
          reason: f.reason,
          frozenAt: f.createdAt.toISOString(),
          unfreezesAt: f.unfreezesAt?.toISOString(),
        })),
      };
    });
  }

  /**
   * Check if wallet is flagged (used for payment validation)
   */
  async isWalletFlagged(walletAddress: string): Promise<boolean> {
    const flag = await this.prisma.walletFlag.findFirst({
      where: {
        wallet: { address: walletAddress },
        status: 'active',
      },
    });
    return !!flag;
  }

  /**
   * Check if creator account is frozen (used for payment validation)
   */
  async isAccountFrozen(creatorId: string): Promise<boolean> {
    const freeze = await this.prisma.accountFreeze.findFirst({
      where: {
        creatorId,
        status: 'active',
      },
    });
    return !!freeze;
  }
}
