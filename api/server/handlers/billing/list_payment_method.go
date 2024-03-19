package billing

import (
	"log"
	"net/http"

	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentmethod"
)

type ListPaymentMethodHandler struct {
	handlers.PorterHandlerWriter
}

func NewListPaymentMethodHandler(
	config *config.Config,
	writer shared.ResultWriter,
) *ListPaymentMethodHandler {
	return &ListPaymentMethodHandler{
		PorterHandlerWriter: handlers.NewDefaultPorterHandler(config, nil, writer),
	}
}

func (c *ListPaymentMethodHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {

	stripe.Key = c.Config().ServerConf.StripeSecretKey
	params := &stripe.PaymentMethodListParams{
		Customer: stripe.String(""),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}
	result := paymentmethod.List(params)

	var paymentMethods []interface{}

	for result.Next() {
		paymentMethods = append(paymentMethods, result.Current())
	}

	log.Println(paymentMethods)

	c.WriteResult(w, r, paymentMethods)
}
