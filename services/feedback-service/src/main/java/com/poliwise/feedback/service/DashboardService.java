package com.poliwise.feedback.service;

import com.poliwise.feedback.dto.response.*;
import com.poliwise.feedback.entity.DailyAggregate;
import com.poliwise.feedback.entity.PopularQuestion;
import com.poliwise.feedback.entity.UnansweredQuestion;
import com.poliwise.feedback.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final DailyAggregateRepository dailyAggregateRepository;
    private final FeedbackRepository feedbackRepository;
    private final UnansweredQuestionRepository unansweredQuestionRepository;
    private final PopularQuestionRepository popularQuestionRepository;
    private final DocumentPopularityRepository documentPopularityRepository;
    private final UsageStatRepository usageStatRepository;

    public DashboardService(
            DailyAggregateRepository dailyAggregateRepository,
            FeedbackRepository feedbackRepository,
            UnansweredQuestionRepository unansweredQuestionRepository,
            PopularQuestionRepository popularQuestionRepository,
            DocumentPopularityRepository documentPopularityRepository,
            UsageStatRepository usageStatRepository) {
        this.dailyAggregateRepository = dailyAggregateRepository;
        this.feedbackRepository = feedbackRepository;
        this.unansweredQuestionRepository = unansweredQuestionRepository;
        this.popularQuestionRepository = popularQuestionRepository;
        this.documentPopularityRepository = documentPopularityRepository;
        this.usageStatRepository = usageStatRepository;
    }

    public DashboardOverviewResponse getOverview() {
        LocalDate today = LocalDate.now();
        LocalDate weekAgo = today.minusDays(7);
        Instant todayStart = today.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant todayEnd = today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant weekStart = weekAgo.atStartOfDay().toInstant(ZoneOffset.UTC);

        DailyAggregate todayAgg = dailyAggregateRepository.findByDate(today).orElse(null);
        long todayQuestions = todayAgg != null ? todayAgg.getTotalQuestions() : 0;

        long weekQuestions = 0;
        for (LocalDate d = weekAgo; !d.isAfter(today); d = d.plusDays(1)) {
            DailyAggregate agg = dailyAggregateRepository.findByDate(d).orElse(null);
            if (agg != null) weekQuestions += agg.getTotalQuestions();
        }

        Long distinctUsers = usageStatRepository.countDistinctUsers(weekStart, todayEnd);
        long activeUsersToday = distinctUsers != null ? distinctUsers : 0;

        long totalLikes = feedbackRepository.countByType(com.poliwise.feedback.enums.FeedbackType.LIKE);
        long totalDislikes = feedbackRepository.countByType(com.poliwise.feedback.enums.FeedbackType.DISLIKE);
        BigDecimal satisfactionRate = BigDecimal.ZERO;
        if (totalLikes + totalDislikes > 0) {
            satisfactionRate = BigDecimal.valueOf(totalLikes)
                    .divide(BigDecimal.valueOf(totalLikes + totalDislikes), 4, RoundingMode.HALF_UP);
        }

        long unansweredCount = unansweredQuestionRepository.countByResolved(false);

        List<PopularQuestionResponse> topQuestions = popularQuestionRepository
                .findTop10ByOrderByAskCountDesc(PageRequest.of(0, 5))
                .stream().map(PopularQuestionResponse::fromEntity).toList();

        List<DocumentPopularityResponse> topDocuments = documentPopularityRepository
                .findTop10ByOrderByTotalCitationsDesc(PageRequest.of(0, 5))
                .stream().map(DocumentPopularityResponse::fromEntity).toList();

        return new DashboardOverviewResponse(todayQuestions, weekQuestions, totalLikes + totalDislikes,
                satisfactionRate, activeUsersToday, unansweredCount, topQuestions, topDocuments);
    }

    public List<TrendResponse> getTrends(int days) {
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(days);
        return dailyAggregateRepository.findByDateBetweenOrderByDateDesc(from, to).stream()
                .map(agg -> new TrendResponse(agg.getDate(), agg.getTotalQuestions(),
                        agg.getTotalLikes() + agg.getTotalDislikes(), agg.getAvgResponseTimeMs(),
                        agg.getUniqueActiveUsers(), agg.getTotalLikes(), agg.getTotalDislikes(), List.of()))
                .toList();
    }

    public Page<UnansweredQuestionResponse> getUnansweredQuestions(Pageable pageable) {
        return unansweredQuestionRepository.findByResolved(false, pageable)
                .map(uq -> new UnansweredQuestionResponse(uq.getId(), uq.getQuestion(), uq.getUserId(),
                        uq.getUserDepartmentId(), uq.getCategory(), uq.getPriority(), uq.getResolved(),
                        uq.getCreatedAt(), uq.getResolvedAt(), uq.getResolutionNotes()));
    }
}
