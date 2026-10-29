#!/bin/sh
set -e

echo "waiting for the AWS emulator..."
for i in $(seq 1 30); do
  if aws s3api list-buckets >/dev/null 2>&1; then break; fi
  sleep 1
done

aws s3api create-bucket --bucket pgsd-uploads-local

DLQ_URL=$(aws sqs create-queue --queue-name pgsd-jobs-dlq --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)

cat > /tmp/attrs.json <<EOF
{"VisibilityTimeout":"120","RedrivePolicy":"{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"}
EOF
aws sqs create-queue --queue-name pgsd-jobs --attributes file:///tmp/attrs.json

aws dynamodb create-table --table-name pgsd-job-results \
  --attribute-definitions AttributeName=jobId,AttributeType=S \
  --key-schema AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "local AWS resources ready"