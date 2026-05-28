package com.poliwise.feedback.feign;

import com.poliwise.feedback.feign.dto.UserStatsResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "user-service", url = "${app.services.user-service-url:http://localhost:8082}")
public interface UserServiceClient {

    @GetMapping("/api/v1/users/stats")
    UserStatsResponse getStats();
}
