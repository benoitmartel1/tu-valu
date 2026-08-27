#!/usr/bin/env node

/**
 * Apply CORS configuration to OVH S3 bucket
 *
 * This script uses the AWS SDK to apply CORS rules to the OVH S3 bucket.
 * OVH S3 is compatible with AWS S3 API.
 *
 * Usage: node apply-cors.js
 */

import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// Load environment variables
const envFile = path.join(process.cwd(), "api", ".env");
let envVars = {};

if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join("=").trim();
      }
    }
  }
}

// OVH S3 Configuration
const config = {
  endpoint: envVars.OVH_S3_ENDPOINT || "https://s3.bhs.io.cloud.ovh.net",
  region: envVars.OVH_S3_REGION || "bhs",
  credentials: {
    accessKeyId: envVars.OVH_S3_ACCESS_KEY,
    secretAccessKey: envVars.OVH_S3_SECRET_KEY,
  },
};

const bucket = envVars.OVH_S3_BUCKET || "young-blackett";

console.log("🔧 Applying CORS configuration to OVH S3 bucket...");
console.log(`   Bucket: ${bucket}`);
console.log(`   Endpoint: ${config.endpoint}`);
console.log(`   Region: ${config.region}`);

// Read CORS configuration
const corsConfigPath = path.join(process.cwd(), "cors.json");
let corsRules;

try {
  const corsData = JSON.parse(fs.readFileSync(corsConfigPath, "utf-8"));
  corsRules = corsData.CORSRules;
  console.log("✅ CORS configuration loaded from cors.json");
} catch (error) {
  console.error("❌ Failed to load cors.json:", error.message);
  process.exit(1);
}

// Create S3 client
const s3Client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  credentials: config.credentials,
  forcePathStyle: true, // Required for OVH and other S3-compatible services
});

async function applyCors() {
  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: corsRules.map((rule) => ({
          AllowedOrigins: rule.AllowedOrigins,
          AllowedMethods: rule.AllowedMethods,
          AllowedHeaders: rule.AllowedHeaders,
          ExposeHeaders: rule.ExposeHeaders,
          MaxAgeSeconds: rule.MaxAgeSeconds,
        })),
      },
    });

    await s3Client.send(command);

    console.log("✅ CORS configuration successfully applied!");
    console.log("\nAllowed Origins:");
    corsRules.forEach((rule) => {
      rule.AllowedOrigins.forEach((origin) => {
        console.log(`   - ${origin}`);
      });
    });
    console.log("\nAllowed Methods:", corsRules[0].AllowedMethods.join(", "));
    console.log("Max Age:", corsRules[0].MaxAgeSeconds, "seconds");
  } catch (error) {
    console.error("❌ Failed to apply CORS configuration:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Verify your OVH S3 credentials in api/.env");
    console.error(
      "2. Ensure you have permission to modify bucket CORS settings",
    );
    console.error("3. Check that the bucket name is correct");
    console.error("\nError details:", error);
    process.exit(1);
  }
}

applyCors();
