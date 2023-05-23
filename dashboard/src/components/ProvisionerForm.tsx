import React, { useEffect, useState, useContext } from "react";
import styled from "styled-components";

import aws from "assets/aws.png";

import Heading from "components/form-components/Heading";
import Helper from "./form-components/Helper";
import ProvisionerSettings from "./ProvisionerSettings";
import ProvisionerSettingsOld from "./ProvisionerSettingsOld";
import Text from "./porter/Text";
import Spacer from "./porter/Spacer";
import AzureProvisionerSettings from "./AzureProvisionerSettings";

type Props = {
  goBack: () => void;
  credentialId: string;
  provider: string;
};

const ProvisionerForm: React.FC<Props> = ({
  goBack,
  credentialId,
  provider,
}) => {
  return (
    <>
      <Text size={16}>
        <BackButton width="155px" onClick={goBack}>
          <i className="material-icons">first_page</i>
          Set credentials
        </BackButton>
        <Spacer inline width="17px" />
        <Img src={aws} />
        Configure settings
      </Text>
      <Spacer y={1} />
      <Text color="helper">Configure settings for your AWS environment.</Text>
      <Spacer y={1} />
      {provider === "aws" && (
        <ProvisionerSettings credentialId={credentialId} />
      )}
      {provider === "azure" && (
        <AzureProvisionerSettings credentialId={credentialId} />
      )}
    </>
  );
};

export default ProvisionerForm;

const Img = styled.img`
  height: 18px;
  margin-right: 15px;
`;

const BackButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 13px;
  height: 35px;
  padding: 5px 13px;
  padding-right: 15px;
  border: 1px solid #ffffff55;
  border-radius: 100px;
  width: ${(props: { width: string }) => props.width};
  color: white;
  background: #ffffff11;

  :hover {
    background: #ffffff22;
  }

  > i {
    color: white;
    font-size: 16px;
    margin-right: 6px;
    margin-left: -2px;
  }
`;
