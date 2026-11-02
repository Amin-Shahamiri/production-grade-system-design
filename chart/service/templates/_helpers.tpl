{{- define "service.selectorLabels" -}}
app.kubernetes.io/name: {{ .Values.name }}
{{- end }}

{{- define "service.labels" -}}
{{ include "service.selectorLabels" . }}
app.kubernetes.io/part-of: docsummarizer
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}