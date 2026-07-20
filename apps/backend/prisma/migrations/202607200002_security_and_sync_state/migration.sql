CREATE TABLE "device_request_nonces" (
  "id" VARCHAR(26) NOT NULL,
  "deviceId" VARCHAR(26) NOT NULL,
  "nonce" VARCHAR(128) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_request_nonces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_request_nonces_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_request_nonces_deviceId_nonce_key" UNIQUE ("deviceId", "nonce")
);
CREATE INDEX "device_request_nonces_expiresAt_idx" ON "device_request_nonces"("expiresAt");

CREATE TABLE "owner_sync_state" (
  "ownerId" VARCHAR(26) NOT NULL,
  "nextSequence" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "owner_sync_state_pkey" PRIMARY KEY ("ownerId"),
  CONSTRAINT "owner_sync_state_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
