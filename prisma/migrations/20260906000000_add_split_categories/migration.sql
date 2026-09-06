-- AlterTable
ALTER TABLE "shared_splits" ADD COLUMN     "showCategories" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shared_split_items" ADD COLUMN     "categoryName" TEXT,
ADD COLUMN     "categoryColor" TEXT;
