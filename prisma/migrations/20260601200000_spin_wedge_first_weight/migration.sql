-- First-spin probability override for the spin wedges.
-- Nullable so existing rows fall back to `weight` until an admin sets a
-- per-wedge override. Both columns use the same "values sum to 100"
-- percentage convention; the picker (pickWedge) renormalises so any
-- positive integer remains valid.

ALTER TABLE "spin_wedges" ADD COLUMN "first_weight" INTEGER;
