# Memora AI — Future Improvements

- [ ] **Gemini API Rate Limits & Quota:** Handle 429, 503, and 504 errors with provider-aware retries and request throttling.
- [ ] **Analysis Failure & Reprocessing:** Add a mechanism to retry failed image-analysis jobs.
- [ ] **Transactional Outbox:** Ensure reliable job scheduling between PostgreSQL and Redis.
- [ ] **Distributed Worker Recovery:** Prevent duplicate recovery operations across multiple worker instances.
- [ ] **Media Deletion & Active Jobs:** Handle media deletion safely while workers are processing jobs.
- [ ] **Worker Logging & Monitoring:** Improve structured logs, queue metrics, and error tracking.
- [ ] **Graceful Worker Shutdown:** Handle active jobs and connections safely during restarts.
- [ ] **Add bulk delete button on frontend**
