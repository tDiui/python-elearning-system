const updateTopicProgress = async (
  transaction,
  { userId, topicId, attempted, correct, averageScore, attemptedAt = new Date() }
) => {
  if (
    !Number.isInteger(userId) ||
    !Number.isInteger(topicId) ||
    !Number.isInteger(attempted) ||
    !Number.isInteger(correct) ||
    attempted <= 0 ||
    correct < 0 ||
    correct > attempted
  ) {
    throw new Error('Dữ liệu cập nhật tiến độ chủ đề không hợp lệ.');
  }

  const existing = await transaction.studentTopicProgress.findFirst({
    where: { UserID: userId, TopicID: topicId }
  });
  const previousAttempted = existing
    ? Number(existing.TotalQuestionsAttempted)
    : 0;
  const previousCorrect = existing ? Number(existing.CorrectAnswers) : 0;
  const totalAttempted = previousAttempted + attempted;
  const totalCorrect = previousCorrect + correct;
  const previousAverage = existing ? Number(existing.AverageScore) || 0 : 0;
  const currentAverage = Math.min(100, Math.max(0, Number(averageScore) || 0));
  const cumulativeAverage = (
    previousAverage * previousAttempted + currentAverage * attempted
  ) / totalAttempted;
  const mastery = (totalCorrect / totalAttempted) * 100;
  const data = {
    TotalQuestionsAttempted: { increment: attempted },
    CorrectAnswers: { increment: correct },
    WrongAnswers: { increment: attempted - correct },
    AverageScore: Number(cumulativeAverage.toFixed(2)),
    MasteryLevel: Number(mastery.toFixed(2)),
    LastAttemptAt: attemptedAt,
    LastUpdated: attemptedAt
  };

  if (existing) {
    await transaction.studentTopicProgress.update({
      where: { ProgressID: existing.ProgressID },
      data
    });
    return;
  }

  await transaction.studentTopicProgress.create({
    data: {
      UserID: userId,
      TopicID: topicId,
      TotalQuestionsAttempted: attempted,
      CorrectAnswers: correct,
      WrongAnswers: attempted - correct,
      AverageScore: Number(currentAverage.toFixed(2)),
      MasteryLevel: Number(mastery.toFixed(2)),
      LastAttemptAt: attemptedAt,
      LastUpdated: attemptedAt
    }
  });
};

module.exports = { updateTopicProgress };
