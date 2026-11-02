data "terraform_remote_state" "platform" {
  backend = "s3"
  config = {
    bucket = "pgsd-tfstate-665768711116"
    key    = "platform/terraform.tfstate"
    region = "us-east-1"
  }
}

locals {
  vpc_id          = data.terraform_remote_state.platform.outputs.vpc_id
  db_subnet_group = data.terraform_remote_state.platform.outputs.database_subnet_group_name
  node_sg_id      = data.terraform_remote_state.platform.outputs.node_security_group_id
}

resource "aws_security_group" "rds" {
  name        = "pgsd-rds"
  description = "PostgreSQL access from EKS nodes only"
  vpc_id      = local.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_nodes" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = local.node_sg_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from EKS nodes"
}

resource "aws_db_instance" "main" {
  identifier = "pgsd-postgres"

  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = "docsummarizer"
  username                    = "pgsd_admin"
  manage_master_user_password = true

  db_subnet_group_name   = local.db_subnet_group
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false //Avoid for production

  backup_retention_period    = 1     //Greater for production
  deletion_protection        = false // Avoid for production
  skip_final_snapshot        = true  // Avoid for production
  auto_minor_version_upgrade = true
  apply_immediately          = true
}