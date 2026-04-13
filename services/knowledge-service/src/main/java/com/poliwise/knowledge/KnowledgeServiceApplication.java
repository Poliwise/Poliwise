package com.poliwise.knowledge;

import com.poliwise.knowledge.config.KnowledgeProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class KnowledgeServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(KnowledgeServiceApplication.class, args);
	}
}