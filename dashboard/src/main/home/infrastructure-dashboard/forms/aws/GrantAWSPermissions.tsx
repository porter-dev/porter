import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import Back from "components/porter/Back";
import Button from "components/porter/Button";
import Container from "components/porter/Container";
import { Error as ErrorComponent } from "components/porter/Error";
import Image from "components/porter/Image";
import Input from "components/porter/Input";
import Link from "components/porter/Link";
import Spacer from "components/porter/Spacer";
import Text from "components/porter/Text";
import VerticalSteps from "components/porter/VerticalSteps";
import { type ButtonStatus } from "main/home/app-dashboard/app-view/AppDataContainer";
import { CloudProviderAWS } from "lib/clusters/constants";
import { isAWSArnAccessible } from "lib/hooks/useCloudProvider";
import { useClusterAnalytics } from "lib/hooks/useClusterAnalytics";
import { useIntercom } from "lib/hooks/useIntercom";

import GrantAWSPermissionsHelpModal from "../../modals/help/permissions/GrantAWSPermissionsHelpModal";
import { CheckItem } from "../../modals/PreflightChecksModal";

type Props = {
  goBack: () => void;
  proceed: ({
    cloudProviderCredentialIdentifier,
  }: {
    cloudProviderCredentialIdentifier: string;
  }) => void;
  projectId: number;
};

const GrantAWSPermissions: React.FC<Props> = ({
  goBack,
  proceed,
  projectId,
}) => {
  const [AWSAccountID, setAWSAccountID] = useState("");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showNeedHelpModal, setShowNeedHelpModal] = useState(false);
  const [accountIdContinueButtonStatus, setAccountIdContinueButtonStatus] =
    useState<ButtonStatus>("");
  const [isAccountAccessible, setIsAccountAccessible] = useState(false);
  const { reportToAnalytics } = useClusterAnalytics();
  const { showIntercomWithMessage } = useIntercom();

  const awsAccountIdInputError = useMemo(() => {
    const regex = /^\d{12}$/;
    if (AWSAccountID.trim().length === 0) {
      return undefined;
    } else if (!regex.test(AWSAccountID)) {
      return "A valid AWS Account ID must be a 12-digit number.";
    }
    return undefined;
  }, [AWSAccountID]);

  const externalId = useMemo(() => {
    if (!AWSAccountID || awsAccountIdInputError) {
      return "";
    }
    let externalId = localStorage.getItem(AWSAccountID);
    if (!externalId) {
      externalId = uuidv4();
      localStorage.setItem(AWSAccountID, externalId);
    }

    return externalId;
  }, [AWSAccountID, awsAccountIdInputError]);

  const data = useQuery(
    [
      "cloudFormationStackCreated",
      AWSAccountID,
      projectId,
      isAccountAccessible,
      externalId,
    ],
    async () => {
      try {
        await isAWSArnAccessible({
          targetArn: `arn:aws:iam::${AWSAccountID}:role/porter-manager`,
          externalId,
          projectId,
        });
        return true;
      } catch (err) {
        return false;
      }
    },
    {
      enabled: currentStep === 3 && !isAccountAccessible, // no need to check if it's already accessible
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    }
  );
  useEffect(() => {
    if (data.isSuccess) {
      setIsAccountAccessible(data.data);
    }
  }, [data]);

  const handleAWSAccountIDChange = (accountId: string): void => {
    setAWSAccountID(accountId);
    setIsAccountAccessible(false); // any time they change the account ID, we need to re-check if it's accessible
  };

  const checkIfAlreadyAccessible = async (): Promise<void> => {
    setAccountIdContinueButtonStatus("loading");
    try {
      await isAWSArnAccessible({
        targetArn: `arn:aws:iam::${AWSAccountID}:role/porter-manager`,
        externalId,
        projectId,
      });
      setCurrentStep(3);
      setIsAccountAccessible(true);
    } catch (err) {
      let shouldProceed = true;
      if (axios.isAxiosError(err)) {
        const parsed = z
          .object({ error: z.string() })
          .safeParse(err.response?.data);
        if (
          parsed.success &&
          parsed.data.error.includes(
            "user does not have access to all projects"
          )
        ) {
          setAccountIdContinueButtonStatus(
            <ErrorComponent
              message={"Unable to proceed. Please reach out to support."}
            />
          );
          showIntercomWithMessage({
            message: "I need help granting AWS permissions.",
          });
          shouldProceed = false;
        }
      }
      if (shouldProceed) {
        setCurrentStep(2);
        setAccountIdContinueButtonStatus("");
      }
    } finally {
      void reportToAnalytics({
        projectId,
        step: "aws-account-id-complete",
        awsAccountId: AWSAccountID,
      });
    }
  };

  const directToAWSLogin = (): void => {
    const loginUrl = `https://signin.aws.amazon.com/console`;
    void reportToAnalytics({
      projectId,
      step: "aws-login-redirect-success",
      loginUrl,
    });
    window.open(loginUrl, "_blank");
  };

  const directToCloudFormation = useCallback(async () => {
    const trustArn = process.env.TRUST_ARN
      ? process.env.TRUST_ARN
      : "arn:aws:iam::108458755588:role/CAPIManagement";
    const cloudFormationUrl = `https://console.aws.amazon.com/cloudformation/home?#/stacks/create/review?templateURL=https://porter-role.s3.us-east-2.amazonaws.com/cloudformation-access-policy.json&stackName=PorterRole&param_TrustArnParameter=${trustArn}`;
    void reportToAnalytics({
      projectId,
      step: "aws-cloudformation-redirect-success",
      awsAccountId: AWSAccountID,
      cloudFormationUrl,
      externalId,
    });
    setCurrentStep(3);
    window.open(cloudFormationUrl, "_blank");
  }, [AWSAccountID, externalId]);

  const handleGrantPermissionsComplete = (): void => {
    proceed({
      cloudProviderCredentialIdentifier: `arn:aws:iam::${AWSAccountID}:role/porter-manager`,
    });
  };

  return (
    <>
      <Back onClick={goBack} />
      <Container row>
        <Image src={CloudProviderAWS.icon} size={22} />
        <Spacer inline x={1} />
        <Text size={21}>Grant AWS permissions</Text>
      </Container>
      <Spacer y={1} />
      <Text color="helper">
        Grant Porter permissions to create infrastructure in your AWS account by
        following 4 simple steps.
      </Text>
      <Spacer y={1} />
      <VerticalSteps
        onlyShowCurrentStep={true}
        currentStep={currentStep}
        steps={[
          <>
            <Text size={16}>Log in to your AWS account</Text>
            <Spacer y={0.5} />
            <Text color="helper">Return to Porter after successful login.</Text>
            <Spacer y={0.5} />
            <AWSButtonContainer>
              <ButtonImg src={CloudProviderAWS.icon} />
              <Button
                width={"170px"}
                onClick={directToAWSLogin}
                color="linear-gradient(180deg, #26292e, #24272c)"
                withBorder
              >
                Log in
              </Button>
            </AWSButtonContainer>
            <Spacer y={1} />
            <Button
              onClick={() => {
                setCurrentStep(1);
              }}
            >
              Continue
            </Button>
          </>,
          <>
            <Text size={16}>Enter your AWS account ID</Text>
            <Spacer y={0.5} />
            <Text color="helper">
              Make sure this is the ID of the account you are currently logged
              into and would like to provision resources in.
            </Text>
            <Spacer y={0.5} />
            <Input
              label={
                <Flex>
                  👤 AWS account ID
                  <i
                    className="material-icons"
                    onClick={() => {
                      window.open(
                        "https://us-east-1.console.aws.amazon.com/billing/home?region=us-east-1#/account",
                        "_blank"
                      );
                    }}
                  >
                    help_outline
                  </i>
                </Flex>
              }
              value={AWSAccountID}
              setValue={handleAWSAccountIDChange}
              placeholder="ex: 915037676314"
              error={awsAccountIdInputError}
            />
            <Spacer y={1} />
            <StepChangeButtonsContainer>
              <Button
                onClick={() => {
                  setCurrentStep(0);
                  setAccountIdContinueButtonStatus("");
                  setAWSAccountID("");
                }}
                color="#222222"
              >
                Back
              </Button>
              <Spacer inline x={0.5} />

              <Button
                onClick={checkIfAlreadyAccessible}
                disabled={
                  awsAccountIdInputError != null ||
                  AWSAccountID.length === 0 ||
                  accountIdContinueButtonStatus !== ""
                }
                status={accountIdContinueButtonStatus}
                loadingText={`Checking if Porter can already access this account`}
              >
                Continue
              </Button>
            </StepChangeButtonsContainer>
          </>,
          <>
            <Text size={16}>Create an AWS CloudFormation stack</Text>
            <Spacer y={0.5} />
            <Text color="helper">
              This grants Porter permissions to create infrastructure in your
              account.
            </Text>
            <Spacer y={0.5} />
            <Text color="helper">
              Clicking the button below will take you to the AWS CloudFormation
              console. Return to Porter after clicking &apos;Create stack&apos;
              in the bottom right corner.
            </Text>
            <Spacer y={0.5} />
            <AWSButtonContainer>
              <ButtonImg src={CloudProviderAWS.icon} />
              <Button
                width={"170px"}
                onClick={directToCloudFormation}
                color="linear-gradient(180deg, #26292e, #24272c)"
                withBorder
                disabled={isAccountAccessible}
                disabledTooltipMessage={
                  "Porter can already access your account!"
                }
              >
                Grant permissions
              </Button>
            </AWSButtonContainer>
            <Spacer y={1} />
            <StepChangeButtonsContainer>
              <Button
                onClick={() => {
                  setCurrentStep(1);
                }}
                color="#222222"
              >
                Back
              </Button>
              <Spacer inline x={0.5} />
              <Button
                onClick={() => {
                  setCurrentStep(3);
                }}
              >
                Continue
              </Button>
            </StepChangeButtonsContainer>
          </>,
          <>
            <Text size={16}>Check permissions</Text>
            <Spacer y={0.5} />
            <Text color="helper">
              Checking if Porter can access AWS account with ID {AWSAccountID}
              . This can take up to a minute.
              <Spacer inline width="10px" />
              <Link
                hasunderline
                onClick={() => {
                  setShowNeedHelpModal(true);
                }}
              >
                Need help?
              </Link>
            </Text>
            <Spacer y={1} />
            {isAccountAccessible ? (
              <CheckItem
                preflightCheck={{
                  title: "AWS account is accessible by Porter!",
                  status: "success",
                }}
              />
            ) : (
              <CheckItem
                preflightCheck={{
                  title: "Checking if AWS account is accessible by Porter",
                  status: "pending",
                }}
              />
            )}
            <Spacer y={1} />
            <Container row>
              <Button
                onClick={() => {
                  setCurrentStep(2);
                }}
                color="#222222"
              >
                Back
              </Button>
              <Spacer inline x={0.5} />
              <Button
                onClick={handleGrantPermissionsComplete}
                disabled={!isAccountAccessible}
              >
                Continue
              </Button>
            </Container>
          </>,
        ]}
      />
      {showNeedHelpModal && (
        <GrantAWSPermissionsHelpModal
          onClose={() => {
            setShowNeedHelpModal(false);
          }}
        />
      )}
    </>
  );
};

export default GrantAWSPermissions;

const StepChangeButtonsContainer = styled.div`
  display: flex;
`;

const Flex = styled.div`
  display: flex;
  ailgn-items: center;
  > i {
    margin-left: 10px;
    font-size: 16px;
    cursor: pointer;
  }
`;

const ButtonImg = styled.img`
  height: 14px;
  margin-right: 12px;
`;

const AWSButtonContainer = styled.div`
  display: flex;
  align-items: center;
`;
