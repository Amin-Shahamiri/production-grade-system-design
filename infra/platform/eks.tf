variable "kubernetes_version" {
  type = string
}

variable "my_ip_cidr" {
  type = string
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  name               = local.cluster_name
  kubernetes_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  endpoint_public_access       = true
  endpoint_public_access_cidrs = [var.my_ip_cidr]
  endpoint_private_access      = true

  authentication_mode                      = "API"
  enable_cluster_creator_admin_permissions = true

  addons = {
    coredns                = {}
    kube-proxy             = {}
    vpc-cni                = { before_compute = true }
    eks-pod-identity-agent = { before_compute = true }
  }

  eks_managed_node_groups = {
    system = {
      instance_types = ["c7i-flex.large"]
      min_size      = 2
      max_size      = 3
      desired_size  = 2
    }
  }

  node_security_group_tags = {
    "karpenter.sh/discovery" = local.cluster_name
  }
}

output "cluster_name" {
  value = module.eks.cluster_name
}