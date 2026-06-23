-- Add partner-visible device status payload for the location/status screen.
ALTER TABLE "Location" ADD COLUMN "device" TEXT;
