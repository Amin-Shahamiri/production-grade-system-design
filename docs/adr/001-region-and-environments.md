## ADR-001: Region and environment

**Here is what we’ll decide.** 

**Region:** us-east-1. Bedrock model availability is broad there, and CloudFront certificates must live in us-east-1 anyway.

**Account:** one AWS account for the whole class.

**Environments:** one EKS cluster, with staging and prod as namespaces.

**Terraform state:** remote, in S3.

*Consequences to record:* real companies use separate accounts per environment for blast-radius isolation, and we accept one account to keep cost and setup small.