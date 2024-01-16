package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Datastore struct {
	gorm.Model

	// ID is a uuid that references the datastore
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	// ProjectID is the ID of the project that the datastore belongs to
	ProjectID uint

	// Name is the name of the datastore
	Name string

	// CloudProvider is the cloud provider that hosts the Kubernetes Cluster. Accepted values: [AWS, GCP, AZURE]
	CloudProvider string `json:"cloud_provider"`

	// CloudProviderID is the ID of the cloud provider account that the datastore belongs to. In the case of AWS, this is the AWS account ID.
	CloudProviderID string `json:"cloud_provider_id"`
}
