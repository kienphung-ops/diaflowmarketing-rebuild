-- Per-user item layout for the mobile 2D scene (separate from the 3D itemPositions).
ALTER TABLE "users" ADD COLUMN "itemPositions2D" JSONB;
