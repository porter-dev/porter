# Telemetry

---

This package enables OpenTelemetry use across Porter, including convenience functions intended for easier consumption

## Getting started

### Initialize a TraceProvider

Setup a TraceProvider, providing the collectorURL which will receive traces.

By default, this TraceProvider will output traces to the console, as well as forwarding them to the Collector.
This allows for using the tracer as a replacement for a logger.
To disable this functionality, set `ConsoleOutput: false` on TracerConfig

```go
	tc := telemetry.TracerConfig{
		ServiceName:  "porter-server",
		CollectorURL: "localhost:4317",
	}
	tp, err := telemetry.InitTracer(ctx, tc)
	if err != nil {
		log.Fatal("Unable to load telemetry: ", err)
	}
	defer func() { tp.TraceProvider.Shutdown(ctx) }()
```

### Creating a new child span

If the context contains a span already, a child span will be created using the following code.
Should no parent span be present in the context, a new span will be created.
The name passed to NewSpan will automatically be namespaced to include `porter.run/`.
In the example below, this will show as `porter.run/reading-from-db`.

```go
    ctx, span := telemetry.NewSpan(ctx, "reading-from-db")
    defer span.End()
    ... // the rest of your code
```

### Adding attributes to a span

Attributes in OpenTelemetry can be thought of as Key-Value pairs that can be efficiently queried for, and compared.
All spans may have as many attributes as your tooling will allow, with no conflicts.
It is fair to think of a span as having a Map of Attributes.
Using NewSpan will attempt to read commonly used attributes such as UserID, ProjectID, etc from the provided context automatically

```go
    ctx, span := telemetry.NewSpan(ctx, "reading-from-db")
    defer span.End()
    telemetry.WithAttributes(
		span,
		AttributeKV{Key: "table", Value: "users"},
		AttributeKV{Key: "database", Value: "us-east-6"},
	)
```

If we were to express our current span as JSON, it would look similar to the following:

```json
{
  "reading-from-db": {
    "table": "users",
    "database": "us-east-6"
  }
}
```

### Handling Errors

Whilst it is common to not log within imported libraries, the same expectation does not quite exist with tracing. There are many nuances to this statement, but for the most part a sensible default is to use the following code when returning errors at almost any level of depth within the codebase

```go
    resp, err := cluster.CreateApplication(ctx)
    if err != nil{
        return telemetry.Error(ctx, span, err, "unable to create application")
    }
```

In some cases, you will want more information in your error message that gets picked up by your observability tool.
Avoid the temptation to interpolate your message, and instead add more attributes to the span within the error case

```go
    resp, err := cluster.CreateApplication(ctx)
    if err != nil{
        telemetry.WithAttributes(
            span,
            AttributeKV{Key: "applicationName", Value: "your-application"},
            AttributeKV{Key: "otherDetails", Value: "This is only relevant when there is an error at this point"},
        )
        return telemetry.Error(ctx, span, err, "unable to create application")
    }
```

## Logging vs Traces

At a very high level, traces can be thought of as similar to structured logs.
With tracing, it is more common to use N number of Key-Value pairs, whereas structured logs tend to use a defined, fixed number of keys.
Whilst timestamps as commonly used in structured logging, they are a core piece of any trace and are included in all spans.
Common mistakes made when upgrading from logs to traces, are in string interpolation.

The following log line would be typical for describing an action where a User with ID 1234, spent $500 in our system

`user 1234 spent $500`

This would be generated by the code

```go
    log.Infof("user %s spent $%s", userID, amount)
```

Using traces, we would break this out so that the userID and amount are separate values, with a message attached for context. In JSON representation, this would be:

```json
{
  "userID": "1234",
  "amount": 500,
  "currency": "USD",
  "message": "user spent money"
}
```

This would be generated by the following code:

```go
    telemetry.WithAttributes(
		span,
		AttributeKV{Key: "userID", Value: "1234"},
		AttributeKV{Key: "amount", Value: 500},
		AttributeKV{Key: "currency", Value: "USD"},
		AttributeKV{Key: "message", Value: "user spent money"},
	)
```

The main difference is that we could now as our Observability tooling system questions such as:

- Tell me all users who spend USD
- Tell me all users who spend EUR over 200
- Tell me all currencies that user 123 used in the last 2 months

Whilst this can also technically be accomplished by well-structured logs, it usually requires intense computational
power in order to index, and parse log lines. This usually means that you end up paying large amount for logging aggregation tools.
