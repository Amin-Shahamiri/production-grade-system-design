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