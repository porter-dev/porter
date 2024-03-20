package billing

import (
	"fmt"
	"log"
	"net/http"

	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared"
	"github.com/porter-dev/porter/api/server/shared/apierrors"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/porter-dev/porter/api/server/shared/requestutils"
	"github.com/porter-dev/porter/api/types"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentmethod"
)

type UpdateBillingHandler struct {
	handlers.PorterHandlerWriter
}

func NewUpdateBillingHandler(
	config *config.Config,
	decoderValidator shared.RequestDecoderValidator,
	writer shared.ResultWriter,
) *UpdateBillingHandler {
	return &UpdateBillingHandler{
		PorterHandlerWriter: handlers.NewDefaultPorterHandler(config, decoderValidator, writer),
	}
}

func (c *UpdateBillingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	stripe.Key = c.Config().ServerConf.StripeSecretKey

	paymentMethodID, reqErr := requestutils.GetURLParamString(r, types.URLParamDatastoreName)
	if reqErr != nil {
		c.HandleAPIError(w, r, apierrors.NewErrInternal(fmt.Errorf("error updating payment method: %w", fmt.Errorf("invalid id parameter"))))
		return
	}

	params := &stripe.PaymentMethodParams{}

	result, err := paymentmethod.Update(paymentMethodID, params)
	if err != nil {
		c.HandleAPIError(w, r, apierrors.NewErrInternal(fmt.Errorf("error updating payment method: %w", err)))
		return
	}

	log.Println(result)

	c.WriteResult(w, r, result)
}
