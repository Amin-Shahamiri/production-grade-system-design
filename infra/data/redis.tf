locals {
  db_subnet_ids = data.terraform_remote_state.platform.outputs.database_subnet_ids
}


resource "aws_elasticache_subnet_group" "redis" {
  name       = "pgsd-redis"
  subnet_ids = local.db_subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "pgsd-redis"
  description = "Redis access from EKS nodes only"
  vpc_id      = local.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_nodes" {
  security_group_id            = aws_security_group.redis.id
  referenced_security_group_id = local.node_sg_id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Redis from EKS nodes"
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "pgsd-redis"
  description          = "Cache and rate limiting for DocSummarizer"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  parameter_group_name = "default.redis7"
  port                 = 6379

  num_cache_clusters         = 1     //Avoid for production
  automatic_failover_enabled = false //Avoid for production

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 0
  apply_immediately        = true
}