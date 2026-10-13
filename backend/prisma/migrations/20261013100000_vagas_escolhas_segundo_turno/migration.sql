-- Migration: 20261013100000_vagas_escolhas_segundo_turno
-- Descrição: Configuração independente de vagas e escolhas, distribuição territorial e suporte a 2º turno como eleição independente.

-- AlterTable: elections
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "parentElectionId" TEXT;
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "elections" ADD COLUMN IF NOT EXISTS "finalResults" JSONB;

-- AlterTable: positions
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "defaultChoicesPerVoter" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "defaultHasSecondRound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "defaultDistribution" TEXT NOT NULL DEFAULT 'ESTADUAL';

-- AlterTable: election_positions
ALTER TABLE "election_positions" ADD COLUMN IF NOT EXISTS "choicesPerVoter" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "election_positions" ADD COLUMN IF NOT EXISTS "hasSecondRound" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "election_positions" ADD COLUMN IF NOT EXISTS "distributionType" TEXT NOT NULL DEFAULT 'ESTADUAL';

-- CreateTable: election_position_states
CREATE TABLE IF NOT EXISTS "election_position_states" (
    "id" TEXT NOT NULL,
    "electionPositionId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "hasSecondRound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_position_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "election_position_states_electionPositionId_stateId_key" ON "election_position_states"("electionPositionId", "stateId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elections_parentElectionId_fkey') THEN
        ALTER TABLE "elections" ADD CONSTRAINT "elections_parentElectionId_fkey" FOREIGN KEY ("parentElectionId") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'election_position_states_electionPositionId_fkey') THEN
        ALTER TABLE "election_position_states" ADD CONSTRAINT "election_position_states_electionPositionId_fkey" FOREIGN KEY ("electionPositionId") REFERENCES "election_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'election_position_states_stateId_fkey') THEN
        ALTER TABLE "election_position_states" ADD CONSTRAINT "election_position_states_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
