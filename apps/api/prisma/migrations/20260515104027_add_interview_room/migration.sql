-- CreateTable
CREATE TABLE "interview_rooms" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "transcript" JSONB,
    "aiScore" JSONB,
    "codeSubmitted" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_rooms_interviewId_key" ON "interview_rooms"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_rooms_roomCode_key" ON "interview_rooms"("roomCode");

-- AddForeignKey
ALTER TABLE "interview_rooms" ADD CONSTRAINT "interview_rooms_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
