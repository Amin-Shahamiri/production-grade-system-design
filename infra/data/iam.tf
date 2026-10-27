locals {
  cluster_name = data.terraform_remote_state.platform.outputs.cluster_name
}

data "aws_iam_policy_document" "pod_identity_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole", "sts:TagSession"]

    principals {
      type        = "Service"
      identifiers = ["pods.eks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "api" {
  statement {
    sid       = "UploadDocuments"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  statement {
    sid       = "EnqueueJobs"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.jobs.arn]
  }
}

data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "ReadDocuments"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  statement {
    sid = "ConsumeJobs"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.jobs.arn]
  }

  statement {
    sid       = "WriteResults"
    actions   = ["dynamodb:PutItem", "dynamodb:UploadItem"]
    resources = [aws_dynamodb_table.results.arn]
  }
}

data "aws_iam_policy_document" "results" {
  statement {
    sid       = "ReadResults"
    actions   = ["dynamodb:GetItem"]
    resources = [aws_dynamodb_table.results.arn]
  }
}

locals {
  service_policies = {
    api     = data.aws_iam_policy_document.api.json
    worker  = data.aws_iam_policy_document.worker.json
    results = data.aws_iam_policy_document.results.json
  }

  environments = ["staging", "prod"]

  associations = {
    for pair in setproduct(keys(local.service_policies), local.environments) :
    "${pair[0]}-${pair[1]}" => {
      service   = pair[0]
      namespace = pair[1]
    }
  }
}

resource "aws_iam_role" "service" {
  for_each           = local.service_policies
  name               = "pgsd-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.pod_identity_trust.json
}

resource "aws_iam_role_policy" "service" {
  for_each = local.service_policies
  name     = "pgsd-${each.key}-access"
  role     = aws_iam_role.service[each.key].id
  policy   = each.value
}

resource "aws_eks_pod_identity_association" "service" {
  for_each        = local.associations
  cluster_name    = local.cluster_name
  namespace       = each.value.namespace
  service_account = each.value.service
  role_arn        = aws_iam_role.service[each.value.service].arn
}