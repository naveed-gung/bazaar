import { ObjectId } from "mongodb";
import { closeDatabase, getDb } from "./client.js";
import { applyDatabaseManifest } from "./manifest.js";
import { logger } from "../logger.js";
import { config } from "../config.js";

const products = [
  ["aura-anc-headphones", "Aura ANC Headphones", "NOVA", "Audio", "audio", 24900, 31900, 5, 428, "p-headphones.jpg", "Deal", "Adaptive noise cancellation with a 40-hour battery and spatial audio tuned by our acoustics lab.", [["Battery", "40 hours"], ["Driver", "40mm dynamic"], ["Connectivity", "Bluetooth 5.4"], ["Weight", "268 g"]]],
  ["pulse-smartwatch-s3", "Pulse Smartwatch S3", "AXIOM", "Wearables", "wearables", 32900, null, 5, 312, "p-smartwatch.jpg", "New", "Always-on AMOLED display, continuous heart-rate tracking and seven days of real-world battery.", [["Display", "1.9\" AMOLED"], ["Battery", "7 days"], ["Water rating", "10 ATM"], ["Sensors", "HR, SpO2, GPS"]]],
  ["vector-65-keyboard", "Vector 65 Keyboard", "VECTOR", "Computing", "computing", 17900, 20900, 4, 196, "p-keyboard.jpg", "Deal", "Hot-swappable mechanical switches, gasket-mounted aluminium chassis and per-key lighting.", [["Layout", "65% / 68 keys"], ["Switches", "Hot-swappable"], ["Chassis", "CNC aluminium"], ["Polling", "1000 Hz"]]],
  ["lumen-mirrorless-x", "Lumen Mirrorless X", "LUMEN", "Cameras", "cameras", 128900, null, 5, 88, "p-camera.jpg", null, "Full-frame 33MP sensor with in-body stabilisation and 6K open-gate video capture.", [["Sensor", "33MP full-frame"], ["Video", "6K 30p"], ["Stabilisation", "5-axis IBIS"], ["Mount", "Universal E"]]],
  ["orbit-smart-speaker", "Orbit Smart Speaker", "ORBIT", "Smart Home", "smart-home", 14900, 18900, 4, 254, "p-speaker.jpg", "Deal", "Room-filling 360° sound with on-device voice processing — nothing leaves your home network.", [["Output", "60 W"], ["Drivers", "360° array"], ["Voice", "On-device"], ["Mesh", "Multi-room"]]],
  ["skyline-drone-pro", "Skyline Drone Pro", "kestrel", "Cameras", "cameras", 89900, null, 5, 141, "p-drone.jpg", "New", "Obstacle-aware flight with a 1-inch gimbal sensor and 42 minutes of airtime per charge.", [["Airtime", "42 min"], ["Sensor", "1-inch CMOS"], ["Range", "12 km"], ["Weight", "595 g"]]],
  ["glide-precision-mouse", "Glide Precision Mouse", "VECTOR", "Gaming", "gaming", 8900, 10900, 4, 372, "p-mouse.jpg", "Deal", "26K optical sensor, 54-gram shell and an 8000 Hz wireless link built for competitive play.", [["Sensor", "26K DPI"], ["Weight", "54 g"], ["Polling", "8000 Hz"], ["Battery", "90 hours"]]],
  ["horizon-vr-headset", "Horizon VR Headset", "AXIOM", "Gaming", "gaming", 54900, null, 4, 117, "p-vr.jpg", "New", "Pancake optics, inside-out tracking and 120 Hz per eye with no external base stations.", [["Resolution", "2160×2160 / eye"], ["Refresh", "120 Hz"], ["Optics", "Pancake"], ["Tracking", "Inside-out"]]],
  ["paper-reader-air", "Paper Reader Air", "NOVA", "Computing", "computing", 19900, null, 4, 203, "p-ereader.jpg", null, "Glare-free 300 ppi display, warm front light and weeks of reading between charges.", [["Display", "7-inch 300 ppi"], ["Storage", "32 GB"], ["Light", "Adjustable warm"], ["Battery", "6 weeks"]]],
  ["halo-desk-lamp", "Halo Desk Lamp", "ORBIT", "Smart Home", "smart-home", 12900, 15900, 4, 164, "p-lamp.jpg", "Deal", "Circadian lighting that shifts temperature through the day, controlled from any device.", [["Output", "800 lumens"], ["Temperature", "2200–6500 K"], ["Control", "App + touch"], ["Finish", "Matte alloy"]]],
  ["nova-x1-phone", "Nova X1 Phone", "NOVA", "Phones", "phones", 79900, 89900, 5, 286, "c-phone.svg", "Deal", "A bright 6.7-inch OLED phone with a 50MP stabilized camera and two-day battery life.", [["Display", "6.7-inch OLED"], ["Camera", "50MP OIS"], ["Storage", "256 GB"], ["Battery", "5100 mAh"]]],
  ["axiom-fold-mini", "Axiom Fold Mini", "AXIOM", "Phones", "phones", 119900, null, 4, 94, "c-phone.svg", "New", "A pocketable foldable phone with a full-size inner display and a useful edge-to-edge cover screen.", [["Inner display", "7.1-inch OLED"], ["Cover display", "3.6-inch OLED"], ["Storage", "512 GB"], ["Hinge rating", "400,000 folds"]]],
  ["vector-studio-14", "Vector Studio 14", "VECTOR", "Laptops", "laptops", 149900, 169900, 5, 173, "c-laptop.svg", "Deal", "A quiet aluminium workstation with a color-accurate 120Hz display and all-day performance.", [["Display", "14.5-inch 3K 120Hz"], ["Memory", "32 GB"], ["Storage", "1 TB SSD"], ["Weight", "1.42 kg"]]],
  ["nova-airbook-13", "Nova Airbook 13", "NOVA", "Laptops", "laptops", 99900, null, 4, 221, "c-laptop.svg", "New", "A thin everyday laptop balancing a crisp display, responsive performance and 18-hour battery.", [["Display", "13.6-inch 2.5K"], ["Memory", "16 GB"], ["Storage", "512 GB SSD"], ["Battery", "Up to 18 hours"]]],
  ["lumen-canvas-tab", "Lumen Canvas Tab", "LUMEN", "Tablets", "tablets", 64900, 72900, 5, 138, "c-tablet.svg", "Deal", "A high-refresh tablet for illustration, entertainment and focused work, with the pen included.", [["Display", "12.4-inch 144Hz"], ["Storage", "256 GB"], ["Pen", "Included"], ["Battery", "11,200 mAh"]]],
  ["paper-note-pro", "Paper Note Pro", "NOVA", "Tablets", "tablets", 44900, null, 4, 87, "c-tablet.svg", "New", "A distraction-free paper tablet with a low-latency pen and a glare-free writing surface.", [["Display", "10.3-inch e-paper"], ["Storage", "64 GB"], ["Pen latency", "18 ms"], ["Weight", "405 g"]]],
  ["lumen-oled-32", "Lumen OLED 32 Monitor", "LUMEN", "TVs & Displays", "displays", 109900, 129900, 5, 152, "c-display.svg", "Deal", "A 4K OLED desktop display with true blacks, 240Hz motion and one-cable laptop docking.", [["Panel", "31.5-inch 4K OLED"], ["Refresh", "240 Hz"], ["Ports", "USB-C 90 W, HDMI 2.1"], ["Color", "99% DCI-P3"]]],
  ["horizon-mini-projector", "Horizon Mini Projector", "AXIOM", "TVs & Displays", "displays", 74900, null, 4, 119, "c-display.svg", "New", "A portable laser projector with automatic setup and a sharp 120-inch picture from compact spaces.", [["Resolution", "4K pixel shift"], ["Brightness", "1200 ANSI lm"], ["Image", "40–120 inches"], ["Audio", "2 × 10 W"]]],
  ["orbit-mesh-wifi-7", "Orbit Mesh Wi-Fi 7", "ORBIT", "Networking", "networking", 49900, 57900, 5, 102, "c-router.svg", "Deal", "A three-node mesh system designed for stable multi-gigabit coverage across busy connected homes.", [["Standard", "Wi-Fi 7"], ["Coverage", "750 m²"], ["Ports", "2.5 GbE"], ["Nodes", "3 pack"]]],
  ["vector-travel-router", "Vector Travel Router", "VECTOR", "Networking", "networking", 11900, null, 4, 76, "c-router.svg", "New", "A secure pocket router that shares hotel, phone or wired internet across all your devices.", [["Standard", "Wi-Fi 6"], ["VPN", "WireGuard"], ["Power", "USB-C"], ["Weight", "148 g"]]],
  ["nova-portable-ssd-2tb", "Nova Portable SSD 2TB", "NOVA", "Storage", "storage", 18900, 22900, 5, 344, "c-storage.svg", "Deal", "A rugged pocket SSD delivering fast encrypted backups over a single USB-C cable.", [["Capacity", "2 TB"], ["Read speed", "2000 MB/s"], ["Protection", "IP65"], ["Encryption", "AES-256"]]],
  ["vector-nas-4", "Vector NAS 4", "VECTOR", "Storage", "storage", 59900, null, 4, 68, "c-storage.svg", "New", "A quiet four-bay personal cloud for automatic backups, media libraries and private sharing.", [["Bays", "4 × SATA"], ["Networking", "2.5 GbE"], ["Memory", "8 GB ECC"], ["Drives", "Not included"]]],
  ["orbit-gan-charger-140", "Orbit GaN Charger 140W", "ORBIT", "Power & Accessories", "power-accessories", 9900, 12900, 5, 413, "c-power.svg", "Deal", "A compact four-port charger that powers a laptop, tablet and phone without carrying extra bricks.", [["Output", "140 W total"], ["Ports", "3 × USB-C, 1 × USB-A"], ["Protocol", "USB PD 3.1"], ["Cable", "240 W included"]]],
  ["nova-power-bank-20k", "Nova Power Bank 20K", "NOVA", "Power & Accessories", "power-accessories", 7900, null, 4, 267, "c-power.svg", "New", "A flight-ready 20,000mAh battery with fast two-way USB-C charging and a clear status display.", [["Capacity", "20,000 mAh"], ["Output", "65 W USB-C"], ["Ports", "2 × USB-C, 1 × USB-A"], ["Display", "Battery percentage"]]],
] as const;

async function main() {
  const db = await getDb();
  await applyDatabaseManifest(db);
  const now = new Date();

  for (const [slug, name, brand, category, categorySlug, priceMinor, compareAtPriceMinor, rating, reviewCount, filename, badge, blurb, specs] of products) {
    const productId = new ObjectId();
    const result = await db.collection("products").findOneAndUpdate(
      { slug },
      { $set: { name, brand, category, categorySlug, priceMinor, ...(compareAtPriceMinor ? { compareAtPriceMinor } : {}), rating, reviewCount, imageUrl: `/catalog/${filename}`, motionUrl: `/catalog/motion/${slug}.mp4`, ...(badge ? { badge } : {}), blurb, specs: specs.map(([label, value]) => ({ label, value })), state: "published", publishedAt: now, updatedAt: now }, $setOnInsert: { _id: productId, revision: 1, createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    if (!result) throw new Error(`Failed to seed ${slug}`);
    const variantId = new ObjectId();
    const variant = await db.collection("variants").findOneAndUpdate(
      { sku: `BZ-${slug.toUpperCase()}` },
      { $set: { productId: result._id, name: "Standard", options: {}, priceMinor, state: "active", updatedAt: now }, $setOnInsert: { _id: variantId, createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    if (!variant) throw new Error(`Failed to seed variant for ${slug}`);
    await db.collection("inventory").updateOne({ variantId: variant._id }, { $setOnInsert: { variantId: variant._id, onHand: 50, reserved: 0, version: 1, updatedAt: now } }, { upsert: true });
  }

  const categories = [...new Map(products.map((item) => [item[4], { slug: item[4], name: item[3], imageUrl: `/catalog/${item[9]}` }])).values()];
  for (const category of categories) await db.collection("categories").updateOne({ slug: category.slug }, { $set: { ...category, state: "published", updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
  await db.collection("promotions").updateOne(
    { code: "WELCOME10" },
    { $set: { name: "Welcome 10%", kind: "percentage", percentOff: 10, maxDiscountMinor: 5000, state: "active", startsAt: new Date("2024-01-01T00:00:00.000Z"), endsAt: new Date("2030-01-01T00:00:00.000Z"), updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  const accounts = [
    { firebaseUid: config.bootstrapAdminUid, email: config.bootstrapAdminEmail, displayName: "Bazaar Admin", roles: ["admin"] },
    { firebaseUid: config.bootstrapClientUid, email: config.bootstrapClientEmail, displayName: "Bazaar Client", roles: ["client"] },
  ] as const;
  for (const account of accounts) {
    if (!account.firebaseUid || !account.email) throw new Error("Both bootstrap Firebase UID and email pairs are required.");
    await db.collection("users").updateOne(
      { firebaseUid: account.firebaseUid },
      { $set: { email: account.email, displayName: account.displayName, roles: [...account.roles], updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  logger.info({ products: products.length, categories: categories.length, accounts: accounts.length }, "catalog and account seed complete");
  await closeDatabase();
}

void main().catch((error) => {
  logger.fatal({ err: error }, "catalog seed failed");
  process.exitCode = 1;
});
