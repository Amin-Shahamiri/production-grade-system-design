output "uploads_bucket" {
  value = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}

output "jobs_queue_url" {
  value = aws_sqs_queue.jobs.url
}

output "jobs_queue_arn" {
  value = aws_sqs_queue.jobs.arn
}

output "jobs_dlq_url" {
  value = aws_sqs_queue.jobs_dlq.url
}

output "results_table_name" {
  value = aws_dynamodb_table.results.name
}

output "results_table_arn" {
  value = aws_dynamodb_table.results.arn
}

output "db_host" {
  value = aws_db_instance.main.address
}

output "db_name" {
  value = aws_db_instance.main.db_name
}

output "db_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "redis_host" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "bedrock_profile_id" {
  value = var.bedrock_profile_id
}