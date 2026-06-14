-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "GroupMembership" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'MEMBER';
