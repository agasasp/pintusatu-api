import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import {
  users,
  branches,
  staffAssignments,
  rooms,
  tenants,
  leases,
  electricityReadings,
  invoices,
  payments,
  tasks,
  financeTransactions,
  saasSubscriptions,
} from "../db/schema.js";

export async function runSeed() {
  console.log("🌱 Starting PintuSatu Database Seeder...");

  try {
    const defaultPassword = await bcrypt.hash("Password123!", 10);

    // ==========================================
    // 1. SEED USERS (Superadmin, Owners, Penjaga)
    // ==========================================
    console.log("👤 Seeding Users...");

    const [superadmin] = await db
      .insert(users)
      .values({
        name: "Superadmin PintuSatu",
        email: "superadmin@pintusatu.id",
        password: defaultPassword,
        role: "superadmin",
        phone: "081100000001",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    const [ownerBudi] = await db
      .insert(users)
      .values({
        name: "Budi Santoso",
        email: "budi.santoso@gmail.com",
        password: defaultPassword,
        role: "owner",
        phone: "081234567890",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    const [ownerCitra] = await db
      .insert(users)
      .values({
        name: "Citra Dewi",
        email: "citra.dewi@gmail.com",
        password: defaultPassword,
        role: "owner",
        phone: "081398765432",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    const budiId = ownerBudi?.id;
    const citraId = ownerCitra?.id;

    if (!budiId || !citraId) {
      console.log("⚠️ Owners already exist or not returned, querying existing IDs...");
      const existingBudi = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, "budi.santoso@gmail.com"),
      });
      const existingCitra = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, "citra.dewi@gmail.com"),
      });
      if (existingBudi && existingCitra) {
        return await seedWithOwners(existingBudi.id, existingCitra.id, defaultPassword);
      }
    } else {
      await seedWithOwners(budiId, citraId, defaultPassword);
    }

    console.log("✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

async function seedWithOwners(budiId: string, citraId: string, defaultPassword: string) {
  // 2. SEED SAAS SUBSCRIPTIONS
  console.log("💳 Seeding SaaS Subscriptions...");
  await db
    .insert(saasSubscriptions)
    .values([
      {
        ownerId: budiId,
        planName: "pro",
        roomQuota: 100,
        pricePerMonth: "350000.00",
        status: "active",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-12-31"),
        isSuspended: false,
      },
      {
        ownerId: citraId,
        planName: "starter",
        roomQuota: 20,
        pricePerMonth: "150000.00",
        status: "active",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-12-31"),
        isSuspended: false,
      },
    ])
    .onConflictDoNothing();

  // 3. SEED STAFF / PENJAGA
  console.log("👷 Seeding Staff / Penjaga...");
  const [staffJoko] = await db
    .insert(users)
    .values({
      name: "Joko Susilo (Penjaga Kemang)",
      email: "joko.penjaga@gmail.com",
      password: defaultPassword,
      role: "penjaga",
      ownerId: budiId,
      phone: "085612345678",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  const [staffAsep] = await db
    .insert(users)
    .values({
      name: "Asep Sunandar (Staff Dago)",
      email: "asep.staff@gmail.com",
      password: defaultPassword,
      role: "penjaga",
      ownerId: citraId,
      phone: "087812345678",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  // 4. SEED BRANCHES
  console.log("🏢 Seeding Kost Branches...");
  const [branchKemang] = await db
    .insert(branches)
    .values({
      ownerId: budiId,
      name: "Grha PintuSatu Kemang Executive",
      slug: "grha-pintusatu-kemang-executive",
      address: "Jl. Kemang Selatan VIII No. 14, RT 07 / RW 02, Bangka, Mampang Prapatan",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      postalCode: "12730",
      coordinates: "-6.2738, 106.8159",
      phone: "021-7198888",
      electricityBillingMode: "meter",
      kwhRate: "2200.00",
      kwhAdminFee: "20000.00",
      rules:
        "1. Tamu lawan jenis tidak diperkenankan menginap.\n2. Gerbang ditutup pukul 23:00 WIB (kunci akses diberikan).\n3. Dilarang merokok di dalam kamar AC.\n4. Hewan peliharaan dilarang.",
    })
    .returning();

  const [branchBSD] = await db
    .insert(branches)
    .values({
      ownerId: budiId,
      name: "PintuSatu Residence BSD City",
      slug: "pintusatu-residence-bsd-city",
      address: "Foresta Cluster Naturale Blok C2 No. 8, BSD City",
      city: "Tangerang Selatan",
      province: "Banten",
      postalCode: "15339",
      coordinates: "-6.3025, 106.6521",
      phone: "021-5379999",
      electricityBillingMode: "token",
      kwhRate: "2000.00",
      kwhAdminFee: "15000.00",
      rules: "Bebas jam malam dengan Smart Card, parkir mobil luas, WiFi 100 Mbps.",
    })
    .returning();

  const [branchDago] = await db
    .insert(branches)
    .values({
      ownerId: citraId,
      name: "Kost Putri PintuSatu Dago Asri",
      slug: "kost-putri-pintusatu-dago-asri",
      address: "Jl. Dago Asri Raya No. 45, Dago",
      city: "Bandung",
      province: "Jawa Barat",
      postalCode: "40135",
      coordinates: "-6.8856, 107.6189",
      phone: "022-2501234",
      electricityBillingMode: "flat",
      kwhRate: "1800.00",
      kwhAdminFee: "10000.00",
      rules: "Khusus mahasiswi/karyawati putri. Tenang dan asri untuk belajar.",
    })
    .returning();

  // Assign staff to branches
  if (staffJoko && branchKemang) {
    await db.insert(staffAssignments).values([
      { staffId: staffJoko.id, branchId: branchKemang.id },
      { staffId: staffJoko.id, branchId: branchBSD.id },
    ]);
  }
  if (staffAsep && branchDago) {
    await db.insert(staffAssignments).values([
      { staffId: staffAsep.id, branchId: branchDago.id },
    ]);
  }

  // 5. SEED ROOMS
  console.log("🛏️ Seeding Rooms...");
  const facilitiesDeluxe = JSON.stringify([
    "AC Daikin 1 PK",
    "Kamar Mandi Dalam",
    "Water Heater Ariston",
    "Kasur Queen Size King Koil",
    "Smart TV 32 Inch",
    "Meja Kerja & Kursi Ergonomis",
    "Lemari Pakaian 3 Pintu",
    "High-speed WiFi",
  ]);

  const facilitiesStandard = JSON.stringify([
    "AC 0.5 PK",
    "Kamar Mandi Dalam",
    "Kasur Single 120x200",
    "Meja Belajar",
    "Lemari Pakaian",
    "WiFi",
  ]);

  const [room101] = await db
    .insert(rooms)
    .values({
      branchId: branchKemang.id,
      roomNumber: "101",
      floor: 1,
      type: "Deluxe Suite",
      basePrice: "2800000.00",
      dailyPrice: "250000.00",
      depositAmount: "500000.00",
      status: "occupied",
      facilities: facilitiesDeluxe,
      meterInitial: "1120.50",
      notes: "Kamar favorit lantai 1 dekat taman dalam",
    })
    .returning();

  const [room102] = await db
    .insert(rooms)
    .values({
      branchId: branchKemang.id,
      roomNumber: "102",
      floor: 1,
      type: "Deluxe Suite",
      basePrice: "2800000.00",
      depositAmount: "500000.00",
      status: "occupied",
      facilities: facilitiesDeluxe,
      meterInitial: "890.00",
    })
    .returning();

  const [room201] = await db
    .insert(rooms)
    .values({
      branchId: branchKemang.id,
      roomNumber: "201",
      floor: 2,
      type: "VIP Balcony",
      basePrice: "3400000.00",
      depositAmount: "1000000.00",
      status: "available",
      facilities: facilitiesDeluxe,
      meterInitial: "450.20",
      notes: "Pemandangan city view Kemang",
    })
    .returning();

  const [room202] = await db
    .insert(rooms)
    .values({
      branchId: branchKemang.id,
      roomNumber: "202",
      floor: 2,
      type: "Standard AC",
      basePrice: "2200000.00",
      depositAmount: "500000.00",
      status: "maintenance",
      facilities: facilitiesStandard,
      meterInitial: "670.00",
      notes: "Sedang perbaikan kran wastafel",
    })
    .returning();

  const [roomDago1] = await db
    .insert(rooms)
    .values({
      branchId: branchDago.id,
      roomNumber: "A-01",
      floor: 1,
      type: "Standard Putri",
      basePrice: "1650000.00",
      depositAmount: "300000.00",
      status: "occupied",
      facilities: facilitiesStandard,
      meterInitial: "0.00",
    })
    .returning();

  // 6. SEED TENANTS
  console.log("👥 Seeding Tenants...");
  const [tenantAndi] = await db
    .insert(tenants)
    .values({
      ownerId: budiId,
      name: "Andi Wijaya",
      email: "andi.wijaya@gmail.com",
      phone: "081298112233",
      identityType: "ktp",
      identityNumber: "3174051208980001",
      emergencyContactName: "Hartono Wijaya",
      emergencyContactPhone: "081298001122",
      emergencyContactRelation: "Orang Tua",
      occupation: "Senior Backend Engineer di GoTo",
      status: "active",
    })
    .returning();

  const [tenantSari] = await db
    .insert(tenants)
    .values({
      ownerId: budiId,
      name: "Sari Puspita",
      email: "sari.puspita@gmail.com",
      phone: "081377889900",
      identityType: "ktp",
      identityNumber: "3171024503990003",
      emergencyContactName: "Bambang Puspita",
      emergencyContactPhone: "081377112233",
      emergencyContactRelation: "Ayah",
      occupation: "Product Manager di Shopee",
      status: "active",
    })
    .returning();

  const [tenantNadia] = await db
    .insert(tenants)
    .values({
      ownerId: citraId,
      name: "Nadia Safira",
      email: "nadia.safira@gmail.com",
      phone: "085712348899",
      identityType: "ktp",
      identityNumber: "3273016010020005",
      emergencyContactName: "Ibu Rina Safira",
      emergencyContactPhone: "085712340000",
      emergencyContactRelation: "Ibu Kandung",
      occupation: "Mahasiswi S1 Farmasi ITB",
      status: "active",
    })
    .returning();

  // 7. SEED ACTIVE LEASES
  console.log("📝 Seeding Leases...");
  const [leaseAndi] = await db
    .insert(leases)
    .values({
      roomId: room101.id,
      tenantId: tenantAndi.id,
      branchId: branchKemang.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      rentPrice: "2800000.00",
      depositPaid: "500000.00",
      billingCycleDay: 1,
      paymentTerm: "monthly",
      status: "active",
    })
    .returning();

  const [leaseSari] = await db
    .insert(leases)
    .values({
      roomId: room102.id,
      tenantId: tenantSari.id,
      branchId: branchKemang.id,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2027-01-31"),
      rentPrice: "2800000.00",
      depositPaid: "500000.00",
      billingCycleDay: 1,
      paymentTerm: "monthly",
      status: "active",
    })
    .returning();

  const [leaseNadia] = await db
    .insert(leases)
    .values({
      roomId: roomDago1.id,
      tenantId: tenantNadia.id,
      branchId: branchDago.id,
      startDate: new Date("2026-01-15"),
      rentPrice: "1650000.00",
      depositPaid: "300000.00",
      billingCycleDay: 15,
      paymentTerm: "monthly",
      electricityBillingModeOverride: "flat",
      status: "active",
    })
    .returning();

  // 8. SEED ELECTRICITY READINGS (Showcasing all 3 modes!)
  console.log("⚡ Seeding 3-Mode Electricity Readings...");
  // Mode 2: Meter reading for Room 101 Kemang
  await db.insert(electricityReadings).values([
    {
      branchId: branchKemang.id,
      roomId: room101.id,
      leaseId: leaseAndi.id,
      recordedBy: staffJoko?.id || budiId,
      periodMonth: 10,
      periodYear: 2026,
      mode: "meter",
      previousReading: "1120.50",
      currentReading: "1285.20",
      kwhUsed: "164.70",
      kwhRate: "2200.00",
      adminFee: "20000.00",
      totalAmount: "382340.00", // (164.7 * 2200) + 20000 = 362340 + 20000 = 382340
      isBilled: true,
      meterPhotoUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31",
    },
    // Mode 1: Token reading for BSD
    {
      branchId: branchBSD.id,
      roomId: room201.id,
      recordedBy: staffJoko?.id || budiId,
      periodMonth: 10,
      periodYear: 2026,
      mode: "token",
      tokenCode: "4521-7890-1234-8901-2345",
      previousReading: "0.00",
      currentReading: "0.00",
      kwhUsed: "0.00",
      kwhRate: "0.00",
      adminFee: "2500.00",
      totalAmount: "202500.00", // Rp 200.000 nominal + Rp 2.500 admin
      isBilled: false,
    },
    // Mode 3: Flat rate reading for Dago
    {
      branchId: branchDago.id,
      roomId: roomDago1.id,
      leaseId: leaseNadia.id,
      recordedBy: staffAsep?.id || citraId,
      periodMonth: 10,
      periodYear: 2026,
      mode: "flat",
      previousReading: "0.00",
      currentReading: "0.00",
      kwhUsed: "0.00",
      kwhRate: "0.00",
      adminFee: "0.00",
      totalAmount: "150000.00", // Flat Rp 150.000/bln
      isBilled: true,
    },
  ]);

  // 9. SEED INVOICES & PAYMENTS
  console.log("💰 Seeding Invoices & Payments...");
  // Paid Invoice for Andi (Rent + Electricity)
  const [invAndi] = await db
    .insert(invoices)
    .values({
      invoiceNumber: "INV/202610/KMNG-001",
      leaseId: leaseAndi.id,
      tenantId: tenantAndi.id,
      roomId: room101.id,
      branchId: branchKemang.id,
      amountRent: "2800000.00",
      amountElectricity: "382340.00",
      amountPenalty: "0.00",
      amountOther: "0.00",
      totalAmount: "3182340.00",
      paidAmount: "3182340.00",
      remainingAmount: "0.00",
      dueDate: new Date("2026-10-05"),
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-31"),
      status: "paid",
      notes: "Sewa bulan Oktober + Listrik Sub-meter",
    })
    .returning();

  await db.insert(payments).values({
    invoiceId: invAndi.id,
    paymentNumber: "PAY/202610/BCA-88912",
    amount: "3182340.00",
    paymentMethod: "bank_transfer",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c",
    status: "approved",
    verifiedBy: budiId,
    verifiedAt: new Date("2026-10-03"),
    notes: "Transfer BCA konfirmasi lunas",
  });

  // Overdue Invoice for Sari with Late Penalty
  await db.insert(invoices).values({
    invoiceNumber: "INV/202610/KMNG-002",
    leaseId: leaseSari.id,
    tenantId: tenantSari.id,
    roomId: room102.id,
    branchId: branchKemang.id,
    amountRent: "2800000.00",
    amountElectricity: "0.00",
    amountPenalty: "125000.00", // Rp 25.000 x 5 days late
    amountOther: "0.00",
    totalAmount: "2925000.00",
    paidAmount: "0.00",
    remainingAmount: "2925000.00",
    dueDate: new Date("2026-10-10"),
    periodStart: new Date("2026-10-01"),
    periodEnd: new Date("2026-10-31"),
    status: "overdue",
    penaltyAppliedAt: new Date("2026-10-15"),
    notes: "Tagihan jatuh tempo dengan denda keterlambatan 5 hari",
  });

  // 10. SEED TASKS (Staff Housekeeping & Asset Maintenance)
  console.log("🧹 Seeding Housekeeping & Maintenance Tasks...");
  await db.insert(tasks).values([
    {
      branchId: branchKemang.id,
      roomId: room202.id,
      assignedTo: staffJoko?.id,
      createdBy: budiId,
      title: "Perbaikan Kran Wastafel & Ganti Seal Kamar 202",
      description: "Air rembes di bawah wastafel kamar mandi. Siapkan seal tape dan kunci pas.",
      taskType: "maintenance",
      priority: "high",
      status: "in_progress",
      cost: "45000.00",
      scheduledDate: new Date("2026-10-21"),
    },
    {
      branchId: branchKemang.id,
      roomId: room201.id,
      assignedTo: staffJoko?.id,
      createdBy: budiId,
      title: "Pembersihan Rutin & Cuci Filter AC Kamar 201",
      description: "Cuci filter indoor AC dan bersihkan debu balkon pasca penyewa sebelumnya.",
      taskType: "asset_service",
      priority: "medium",
      status: "completed",
      cost: "75000.00",
      afterPhotoUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952",
      completedAt: new Date("2026-10-19"),
    },
  ]);

  // 11. SEED FINANCE TRANSACTIONS (Petty Cash & NOI)
  console.log("📊 Seeding Finance & Petty Cash Transactions...");
  await db.insert(financeTransactions).values([
    // Income
    {
      branchId: branchKemang.id,
      userId: budiId,
      approvedBy: budiId,
      category: "rental_income",
      type: "income",
      amount: "3182340.00",
      description: "Pemasukan sewa Kamar 101 Andi Wijaya bulan Okt 2026",
      approvalStatus: "approved",
      transactionDate: new Date("2026-10-03"),
    },
    // Approved Expense: WiFi
    {
      branchId: branchKemang.id,
      userId: budiId,
      approvedBy: budiId,
      category: "wifi_utility",
      type: "expense",
      amount: "650000.00",
      description: "Tagihan Biznet Dedicated Fiber Optic 150 Mbps Kemang",
      approvalStatus: "approved",
      transactionDate: new Date("2026-10-05"),
    },
    // Approved Kas Kecil: Cleaning Supplies
    {
      branchId: branchKemang.id,
      userId: staffJoko?.id || budiId,
      approvedBy: budiId,
      category: "cleaning_supplies",
      type: "expense",
      amount: "185000.00",
      description: "[KAS KECIL] Beli Wipol 5L, Sunlight, Kantong Sampah, dan Pewangi Ruangan Stella",
      receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c",
      approvalStatus: "approved",
      transactionDate: new Date("2026-10-12"),
    },
    // Pending Kas Kecil
    {
      branchId: branchKemang.id,
      userId: staffJoko?.id || budiId,
      category: "petty_cash",
      type: "expense",
      amount: "85000.00",
      description: "[KAS KECIL] Penggantian 4 lampu LED Philips 12W lorong lantai 2",
      receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c",
      approvalStatus: "pending",
      transactionDate: new Date("2026-10-20"),
    },
  ]);
}

// Direct CLI execution support
if (process.argv[1]?.endsWith("seed.ts")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
