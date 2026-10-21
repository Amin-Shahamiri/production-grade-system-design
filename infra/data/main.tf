data "aws_caller_identity" "current" {}

# ---------- S3: raw uploads ----------

resource "aws_s3_bucket" "uploads" {
  bucket        = "pgsd-uploads-${data.aws_caller_identity.current.account_id}"
  force_destroy = true //This is for Lab, prevent using this in production
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "expire-uploads"
    status = "Enabled"
    filter {}
    expiration {
      days = 7
    }
  }
}

data "aws_iam_policy_document" "uploads_tls_only" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.uploads.arn, "${aws_s3_bucket.uploads.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads" {
  bucket     = aws_s3_bucket.uploads.id
  policy     = data.aws_iam_policy_document.uploads_tls_only.json
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# ---------- SQS: job queue and dead-letter queue ----------

resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "pgsd-jobs-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "jobs" {
  name                       = "pgsd-jobs"
  visibility_timeout_seconds = 120
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

# ---------- DynamoDB: job results ----------

resource "aws_dynamodb_table" "results" {
  name         = "pgsd-job-results"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }

  ttl {
    attribute_name = "expireAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
}

