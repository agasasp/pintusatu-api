import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, staffAssignments, saasSubscriptions } from "../../db/schema.js";
import { env } from "../../config/env.js";
import type {
  RegisterInput,
  LoginInput,
  CreateStaffInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from "./auth.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";

export class AuthService {
  /**
   * Generates a signed JWT token
   */
  static generateToken(user: {
    id: string;
    name: string;
    email: string;
    role: "superadmin" | "owner" | "penjaga" | "tenant";
    ownerId?: string | null;
    isImpersonated?: boolean;
    impersonatedBy?: string;
  }): string {
    const payload: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.ownerId,
      isImpersonated: user.isImpersonated,
      impersonatedBy: user.impersonatedBy,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Register a new Kost Owner
   */
  static async registerOwner(input: RegisterInput) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new Error("Email is already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        password: hashedPassword,
        phone: input.phone || null,
        role: "owner",
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        createdAt: users.createdAt,
      });

    // Auto-create SaaS subscription trial for new owner
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day free trial

    await db.insert(saasSubscriptions).values({
      ownerId: newUser.id,
      planName: "starter",
      roomQuota: 20,
      pricePerMonth: "150000.00",
      status: "trial",
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate,
      isSuspended: false,
    });

    const token = this.generateToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      user: newUser,
      token,
    };
  }

  /**
   * Login user (Owner, Superadmin, Penjaga, Tenant)
   */
  static async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      throw new Error("Account has been deactivated. Please contact support.");
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    const token = this.generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ownerId: user.ownerId,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        ownerId: user.ownerId,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  /**
   * Create staff / penjaga account by Kost Owner
   */
  static async createStaff(ownerId: string, input: CreateStaffInput) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new Error("Email is already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const [newStaff] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        password: hashedPassword,
        phone: input.phone || null,
        role: "penjaga",
        ownerId: ownerId,
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        ownerId: users.ownerId,
        createdAt: users.createdAt,
      });

    // Assign to branches if specified
    if (input.branchIds && input.branchIds.length > 0) {
      for (const branchId of input.branchIds) {
        await db.insert(staffAssignments).values({
          staffId: newStaff.id,
          branchId,
        });
      }
    }

    return newStaff;
  }

  /**
   * Get user profile by ID
   */
  static async getProfile(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        ownerId: users.ownerId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Update profile
   */
  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const [updated] = await db
      .update(users)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        updatedAt: users.updatedAt,
      });

    return updated;
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, input: ChangePasswordInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current password does not match");
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { message: "Password updated successfully" };
  }

  /**
   * List staff belonging to an owner
   */
  static async listStaff(ownerId: string) {
    return await db.query.users.findMany({
      where: (u, { eq, and }) => and(eq(u.ownerId, ownerId), eq(u.role, "penjaga")),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
      with: {
        staffAssignments: {
          with: {
            branch: {
              columns: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
      },
    });
  }
}
