package com.poliwise.feedback.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record DashboardOverviewResponse(
        long todayQuestions,
        long weekQuestions,
        long totalFeedbacks,
        BigDecimal satisfactionRate,
        long activeUsersToday,
        long unansweredCount,
        List<PopularQuestionResponse> topQuestions,
        List<DocumentPopularityResponse> topDocuments
) {}
