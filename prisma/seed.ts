import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const superAdminTenant = await prisma.tenant.upsert({
    where: { slug: "super-admin" },
    update: {},
    create: { name: "Super Admin", slug: "super-admin" },
  });

  const bankTenant = await prisma.tenant.upsert({
    where: { slug: "bk-group" },
    update: {},
    create: { name: "BK Group", slug: "bk-group" },
  });

  const hotelTenant = await prisma.tenant.upsert({
    where: { slug: "marriott" },
    update: {},
    create: { name: "Kigali Marriott Hotel", slug: "marriott" },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@hcc.com" },
    update: {},
    create: {
      email: "admin@hcc.com",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      tenantId: superAdminTenant.id,
    },
  });

  const corporateAdmin = await prisma.user.upsert({
    where: { email: "corp-admin@bkgroup.com" },
    update: {},
    create: {
      email: "corp-admin@bkgroup.com",
      passwordHash,
      firstName: "Corporate",
      lastName: "Admin",
      role: "CORPORATE_ADMIN",
      tenantId: bankTenant.id,
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: "employee1@bkgroup.com" },
    update: {},
    create: {
      email: "employee1@bkgroup.com",
      passwordHash,
      firstName: "John",
      lastName: "Doe",
      role: "CORPORATE_EMPLOYEE",
      tenantId: bankTenant.id,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: "employee2@bkgroup.com" },
    update: {},
    create: {
      email: "employee2@bkgroup.com",
      passwordHash,
      firstName: "Alice",
      lastName: "Smith",
      role: "CORPORATE_EMPLOYEE",
      tenantId: bankTenant.id,
    },
  });

  const marriott = await prisma.serviceProvider.upsert({
    where: { code: "MAR-001" },
    update: {},
    create: {
      name: "Kigali Marriott Hotel",
      code: "MAR-001",
      category: "Hotel",
      description: "Premium hotel in the heart of Kigali.",
      phone: "+250 788 400 400",
      email: "info@marriottkigali.rw",
      latitude: -1.9542,
      longitude: 30.0648,
      address: "KN 3 Ave, Kigali, Rwanda",
      rating: 4.7,
      tenantId: hotelTenant.id,
    },
  });

  const hotelOperator = await prisma.user.upsert({
    where: { email: "operator@marriott.com" },
    update: {},
    create: {
      email: "operator@marriott.com",
      passwordHash,
      firstName: "Hotel",
      lastName: "Operator",
      role: "HOTEL_OPERATOR",
      tenantId: hotelTenant.id,
      serviceProviderId: marriott.id,
    },
  });

  const radisson = await prisma.serviceProvider.upsert({
    where: { code: "RAD-001" },
    update: {},
    create: {
      name: "Radisson Blu Hotel",
      code: "RAD-001",
      category: "Hotel",
      description: "Upscale hotel with modern amenities.",
      phone: "+250 788 500 500",
      email: "info@radissonblukigali.rw",
      latitude: -1.9612,
      longitude: 30.1015,
      address: "KN 2 Rd, Kigali, Rwanda",
      rating: 4.5,
      tenantId: hotelTenant.id,
    },
  });

  const radissonOperator = await prisma.user.upsert({
    where: { email: "operator@radisson.com" },
    update: {},
    create: {
      email: "operator@radisson.com",
      passwordHash,
      firstName: "Radisson",
      lastName: "Operator",
      role: "HOTEL_OPERATOR",
      tenantId: hotelTenant.id,
      serviceProviderId: radisson.id,
    },
  });

  const serena = await prisma.serviceProvider.upsert({
    where: { code: "SER-001" },
    update: {},
    create: {
      name: "Serena Hotel Kigali",
      code: "SER-001",
      category: "Hotel",
      description: "Luxury accommodations with event spaces, spa, and restaurant services.",
      phone: "+250 788 300 303",
      email: "contact@serenakigali.rw",
      latitude: -1.9491,
      longitude: 30.0701,
      address: "KN 4 Ave, Kigali, Rwanda",
      rating: 4.8,
      tenantId: hotelTenant.id,
    },
  });

  const serenaOperator = await prisma.user.upsert({
    where: { email: "operator@serena.com" },
    update: {},
    create: {
      email: "operator@serena.com",
      passwordHash,
      firstName: "Serena",
      lastName: "Operator",
      role: "HOTEL_OPERATOR",
      tenantId: hotelTenant.id,
      serviceProviderId: serena.id,
    },
  });

  // Create a PER_DIEM card for employee1
  const cardPerDiem = await prisma.card.upsert({
    where: { id: "seed-card-pd-001" },
    update: {},
    create: {
      id: "seed-card-pd-001",
      type: "PER_DIEM",
      status: "ACTIVE",
      cardNumber: "4111111111114321",
      last4: "4321",
      amount: 500000,
      spent: 0,
      validityType: "RANGE",
      validFrom: new Date("2025-01-01"),
      validUntil: new Date("2025-12-31"),
      purpose: "Travel & Accommodation",
      distributed: false,
      cardPassword: await bcrypt.hash("card1234", 10),
      tenantId: bankTenant.id,
      createdById: corporateAdmin.id,
    },
  });

  await prisma.cardEmployee.upsert({
    where: { cardId_employeeId: { cardId: cardPerDiem.id, employeeId: employee1.id } },
    update: {},
    create: { cardId: cardPerDiem.id, employeeId: employee1.id },
  });

  // Create a CORPORATE_EXPENSE card for the team
  const cardCorpExpense = await prisma.card.upsert({
    where: { id: "seed-card-ce-001" },
    update: {},
    create: {
      id: "seed-card-ce-001",
      type: "CORPORATE_EXPENSE",
      status: "ACTIVE",
      cardNumber: "4111111111118765",
      last4: "8765",
      limit: 2000000,
      spent: 0,
      validityType: "SINGLE",
      purpose: "Marketing & Events",
      distributed: true,
      cardPassword: await bcrypt.hash("card1234", 10),
      tenantId: bankTenant.id,
      createdById: corporateAdmin.id,
      teamLeaderId: corporateAdmin.id,
    },
  });

  const now = new Date();
  const txs = [
    // Marriott PENDING
    { id: "seed-tx-001", title: "Room charge", amount: 185000, status: "PENDING" as const, reference: "RC-20260521-001", paymentMethod: "Corporate card", details: "One-night stay including minibar and room service.", clientName: "John Doe", clientOrg: "BK Group", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-002", title: "Restaurant dinner", amount: 95000, status: "PENDING" as const, reference: "DIN-20260530-002", paymentMethod: "Corporate card", details: "Business dinner with client.", clientName: "Alice Smith", clientOrg: "MTN Rwanda", cardId: cardPerDiem.id, userId: employee2.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-003", title: "Conference room rental", amount: 250000, status: "PENDING" as const, reference: "CR-20260530-003", paymentMethod: "Corporate card", details: "Full-day boardroom rental with AV equipment.", clientName: "Corporate Team", clientOrg: "RwandAir", cardId: cardCorpExpense.id, userId: corporateAdmin.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-004", title: "Spa package", amount: 65000, status: "PENDING" as const, reference: "SPA-20260530-004", paymentMethod: "Corporate card", details: "Wellness and spa treatment package.", clientName: "Sarah Jones", clientOrg: "Bralirwa", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-005", title: "Breakfast buffet", amount: 45000, status: "PENDING" as const, reference: "BRK-20260530-005", paymentMethod: "Corporate card", details: "Continental breakfast buffet for 10 guests.", clientName: "Jean Bizimana", clientOrg: "BK Group", cardId: cardCorpExpense.id, userId: corporateAdmin.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-006", title: "Laundry service", amount: 25000, status: "PENDING" as const, reference: "LND-20260530-006", paymentMethod: "Corporate card", details: "Express laundry and dry cleaning.", clientName: "Alice Smith", clientOrg: "MTN Rwanda", cardId: cardPerDiem.id, userId: employee2.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-007", title: "Mini bar charges", amount: 32000, status: "PENDING" as const, reference: "MB-20260530-007", paymentMethod: "Corporate card", details: "In-room mini bar consumption.", clientName: "Sarah Jones", clientOrg: "Bralirwa", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-008", title: "Airport transfer", amount: 55000, status: "PENDING" as const, reference: "TRF-20260530-008", paymentMethod: "Corporate card", details: "Private airport transfer for VIP guest.", clientName: "John Doe", clientOrg: "BK Group", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
    // Radisson PENDING
    { id: "seed-tx-002", title: "Food & Beverage", amount: 42500, status: "PENDING" as const, reference: "FNB-20260521-002", paymentMethod: "Corporate card", details: "Lunch and refreshments for a client meeting.", clientName: "Alice Smith", clientOrg: "MTN Rwanda", cardId: cardCorpExpense.id, userId: employee2.id, serviceProviderId: radisson.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    { id: "seed-tx-rad-002", title: "Conference room rental", amount: 180000, status: "PENDING" as const, reference: "CRR-20260530-002", paymentMethod: "Corporate card", details: "Half-day boardroom rental with projector.", clientName: "Corporate Team", clientOrg: "RwandAir", cardId: cardCorpExpense.id, userId: corporateAdmin.id, serviceProviderId: radisson.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
    { id: "seed-tx-rad-003", title: "Restaurant dinner", amount: 78000, status: "PENDING" as const, reference: "DIN-20260530-003", paymentMethod: "Corporate card", details: "Business dinner for 6 guests.", clientName: "Alice Smith", clientOrg: "MTN Rwanda", cardId: cardPerDiem.id, userId: employee2.id, serviceProviderId: radisson.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000) },
    // Serena PENDING + DISPUTED
    { id: "seed-tx-003", title: "Breakfast catering", amount: 280000, status: "PENDING" as const, reference: "BR-20260520-003", paymentMethod: "Corporate card", details: "Breakfast with AV and catering services for a 3-hour event.", clientName: "Corporate Team", clientOrg: "RwandAir", cardId: cardCorpExpense.id, userId: corporateAdmin.id, serviceProviderId: serena.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    { id: "seed-tx-004", title: "Spa services", amount: 85000, status: "DISPUTED" as const, reference: "SPA-20260519-004", paymentMethod: "Corporate card", details: "Spa and wellness package.", clientName: "Sarah Jones", clientOrg: "Bralirwa", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: serena.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
    // Marriott SETTLED
    { id: "seed-tx-005", title: "Conference room booking", amount: 120000, status: "SETTLED" as const, reference: "CRB-20260518-005", paymentMethod: "Corporate card", details: "Boardroom rental for half-day executive meeting.", clientName: "Jean Bizimana", clientOrg: "BK Group", cardId: cardCorpExpense.id, userId: corporateAdmin.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-settled-001", title: "Catering service", amount: 310000, status: "SETTLED" as const, reference: "CAT-20260515-001", paymentMethod: "Corporate card", details: "Full-day catering for board meeting.", clientName: "John Doe", clientOrg: "BK Group", cardId: cardPerDiem.id, userId: employee1.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 120 * 60 * 60 * 1000) },
    { id: "seed-tx-mar-settled-002", title: "Room service", amount: 175000, status: "SETTLED" as const, reference: "RS-20260514-002", paymentMethod: "Corporate card", details: "Premium room service for executive suite.", clientName: "Alice Smith", clientOrg: "MTN Rwanda", cardId: cardPerDiem.id, userId: employee2.id, serviceProviderId: marriott.id, tenantId: bankTenant.id, createdAt: new Date(now.getTime() - 168 * 60 * 60 * 1000) },
  ];

  for (const tx of txs) {
    await prisma.transaction.upsert({
      where: { id: tx.id },
      update: {},
      create: tx,
    });
  }

  console.log("Seed completed successfully!");
  console.log("---");
  console.log("Login credentials (password: password123 for all):");
  console.log("Super Admin: admin@hcc.com");
  console.log("Corporate Admin: corp-admin@bkgroup.com");
  console.log("Employee 1: employee1@bkgroup.com (card password: card1234)");
  console.log("Employee 2: employee2@bkgroup.com (card password: card1234)");
  console.log("Hotel Operator (Marriott): operator@marriott.com");
  console.log("Hotel Operator (Radisson): operator@radisson.com");
  console.log("Hotel Operator (Serena): operator@serena.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
