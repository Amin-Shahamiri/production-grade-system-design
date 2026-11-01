output "registery" {
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.us-east-1.amazonaws.com"
}

output "repository_urls" {
  value = { for name, repo in aws_ecr_repository.service : name => repo.repository_url }
}

output "github_ci_role_arn" {
  value = aws_iam_role.github_ci.arn
}