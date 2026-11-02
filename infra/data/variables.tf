variable "bedrock_profile_id" {
  type        = string
  description = "Bedrock inference profile that the worker calls. It must match BEDROCK_MODEL_ID in the Helm values."
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "bedrock_model_id" {
  type        = string
  description = "The foundation model behind the profile."
  default     = "anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "bedrock_regions" {
  type        = list(string)
  description = "Regions where the profile can run the model. Get them with: aws bedrock get-inference-profile"
  default     = ["us-east-1", "us-east-2", "us-west-2"]
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}