ALTER TABLE "device_pairings"
  ADD COLUMN "pairingCodeHash" VARCHAR(128),
  ADD COLUMN "candidateDeviceId" VARCHAR(26),
  ALTER COLUMN "candidatePublicKey" DROP NOT NULL,
  ALTER COLUMN "candidateFingerprint" DROP NOT NULL,
  ALTER COLUMN "candidatePlatform" DROP NOT NULL;

CREATE UNIQUE INDEX "device_pairings_pairingCodeHash_key" ON "device_pairings"("pairingCodeHash");
