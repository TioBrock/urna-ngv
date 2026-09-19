-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VoterStatus" AS ENUM ('IN_PROGRESS', 'VOTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('VALID', 'BLANK', 'NULL');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('ELECTION_CREATED', 'ELECTION_UPDATED', 'ELECTION_STATUS_CHANGED', 'ELECTION_OPENED', 'ELECTION_PAUSED', 'ELECTION_CLOSED', 'POSITION_CREATED', 'POSITION_UPDATED', 'POSITION_DELETED', 'CANDIDATE_CREATED', 'CANDIDATE_UPDATED', 'CANDIDATE_DELETED', 'STATE_CREATED', 'STATE_UPDATED', 'VOTER_SESSION_STARTED', 'VOTER_SESSION_COMPLETED', 'VOTER_SESSION_ABANDONED', 'VOTE_REGISTERED', 'DUPLICATE_VOTE_ATTEMPT', 'INVALID_CANDIDATE_ATTEMPT', 'DUPLICATE_CANDIDATE_ATTEMPT', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'CONFIG_CHANGED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "showResultsDuringVoting" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutHours" INTEGER NOT NULL DEFAULT 2,
    "validateIp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_states" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'ESTADUAL',
    "defaultDigitCount" INTEGER NOT NULL DEFAULT 2,
    "defaultSlots" INTEGER NOT NULL DEFAULT 1,
    "defaultVotingSystem" TEXT NOT NULL DEFAULT 'MAJORITARIO',
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_positions" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "digitCount" INTEGER NOT NULL DEFAULT 2,
    "votingSystem" TEXT NOT NULL DEFAULT 'MAJORITARIO',
    "isNational" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "election_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "stateId" TEXT,
    "name" TEXT NOT NULL,
    "electoralName" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "photoUrl" TEXT,
    "viceCandidateName" TEXT,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_sessions" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "rpgName" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "status" "VoterStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentPositionOrder" INTEGER NOT NULL DEFAULT 0,
    "currentSlot" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voter_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "voterSessionId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "electionPositionId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "type" "VoteType" NOT NULL,
    "candidateId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "electionId" TEXT,
    "adminUserId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "states_name_key" ON "states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "states_abbreviation_key" ON "states"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "election_states_electionId_stateId_key" ON "election_states"("electionId", "stateId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "election_positions_electionId_positionId_key" ON "election_positions"("electionId", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "election_positions_electionId_order_key" ON "election_positions"("electionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_electionId_positionId_number_stateId_key" ON "candidates"("electionId", "positionId", "number", "stateId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_voterSessionId_electionPositionId_slot_key" ON "votes"("voterSessionId", "electionPositionId", "slot");

-- AddForeignKey
ALTER TABLE "election_states" ADD CONSTRAINT "election_states_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_states" ADD CONSTRAINT "election_states_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_positions" ADD CONSTRAINT "election_positions_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_positions" ADD CONSTRAINT "election_positions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_sessions" ADD CONSTRAINT "voter_sessions_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_sessions" ADD CONSTRAINT "voter_sessions_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voterSessionId_fkey" FOREIGN KEY ("voterSessionId") REFERENCES "voter_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_electionPositionId_fkey" FOREIGN KEY ("electionPositionId") REFERENCES "election_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

