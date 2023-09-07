import React, { useEffect, useState } from "react";
import styled from "styled-components";

type Props = {
  steps: React.ReactNode[];
  currentStep: number;
};

const VerticalSteps: React.FC<Props> = ({
  steps,
  currentStep,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <StyledVerticalSteps>
      {steps.map((step, i) => {
        return (
          <StepWrapper isLast={i === steps.length - 1} key={i}>
            {
              (i !== steps.length - 1) && (
                <Line isActive={i + 1 <= currentStep} />
              )
            }
            <Dot isActive={i <= currentStep}>
              <Number>{i+1}</Number>
            </Dot>
            <OpacityWrapper isActive={i <= currentStep}>
              {step}
              {
                i > currentStep && (
                  <ReadOnlyOverlay />
                )
              }
            </OpacityWrapper>
          </StepWrapper>
        );
      })}
    </StyledVerticalSteps>
  );
};

export default VerticalSteps;

const Number = styled.div`
  font-size: 12px;
  color: #fff;
`;

const ReadOnlyOverlay = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 999;
`;

const Line = styled.div<{
  isActive: boolean;
}>`
  width: 1px;
  height: calc(100% + 35px);
  background: #414141;
  position: absolute;
  left: 4px;
  top: 8px;
  opacity: 1;
`;

const Dot = styled.div<{
  isActive: boolean;
}>`
  width: 31px;
  height: 31px;
  background: ${props => props.isActive ? "#3D48C3" : "#121212"};
  border-radius: 50%;
  position: absolute;
  left: -11px;
  top: -3px;
  opacity: 1;
  border: 6px solid #121212;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const OpacityWrapper = styled.div<{
  isActive: boolean;
}>`
  opacity: ${props => props.isActive ? 1 : 0.5};
`;

const StepWrapper = styled.div<{
  isLast: boolean;
}>`
  padding-left: 30px;
  position: relative;
  margin-bottom: ${props => props.isLast ? "" : "35px"};
`;

const StyledVerticalSteps = styled.div<{
}>`
`;