import React, { useEffect, useState, useRef } from "react";

import styled from "styled-components";
import arrow from "assets/arrow-down.svg";

type Props = {
  name: string;
  icon?: any;
  options: { value: any; label: string }[];
  selected: any;
  setSelected: any;
  noMargin?: boolean;
};

const RadioFilter: React.FC<Props> = (props) => {
  const [expanded, setExpanded] = useState(false);

  const wrapperRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside.bind(this));
    return () =>
      document.removeEventListener("mousedown", handleClickOutside.bind(this));
  }, []);

  const handleClickOutside = (event: any) => {
    if (
      wrapperRef &&
      wrapperRef.current &&
      !wrapperRef.current.contains(event.target) &&
      parentRef &&
      parentRef.current &&
      !parentRef.current.contains(event.target)
    ) {
      setExpanded(false);
    }
  };

  const getLabel = (value: string): any => {
    let tgt = props.options.find(
      (element: { value: string; label: string }) => element.value === value
    );
    if (tgt) {
      return tgt.label;
    }
  };

  const renderDropdown = () => {
    let { options } = props;
    if (expanded) {
      return (
        <DropdownWrapper>
          <Dropdown ref={wrapperRef}>
            {options?.length > 0 ? (
              <ScrollableWrapper>
                {options.map(
                  (option: { value: any; label: string }, i: number) => {
                    return (
                      <OptionRow
                        isLast={i === options.length - 1}
                        onClick={() => props.setSelected(option.value)}
                        key={i}
                        selected={props.selected === option.value}
                      >
                        <Text>{option.label}</Text>
                      </OptionRow>
                    );
                  }
                )}
              </ScrollableWrapper>
            ) : (
              <Placeholder>No options found</Placeholder>
            )}
          </Dropdown>
        </DropdownWrapper>
      );
    }
  };

  return (
    <Relative>
      <StyledRadioFilter
        onClick={() => setExpanded(!expanded)}
        ref={parentRef}
        noMargin={props.noMargin}
      >
        {props.icon && <FilterIcon src={props.icon} />}
        {props.name}
        <Bar />
        <Selected>
          {props.selected
            ? props.selected === ""
              ? "All"
              : getLabel(props.selected)
            : ""}
        </Selected>
        <DropdownIcon src={arrow} />
      </StyledRadioFilter>
      {renderDropdown()}
    </Relative>
  );
};

export default RadioFilter;

const Bar = styled.div`
  width: 1px;
  height: calc(18px);
  background: #494b4f;
  margin: 0 8px;
`;

const Selected = styled.div`
  color: #aaaaaa;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 120px;
`;

const Text = styled.div`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  word-break: anywhere;
  margin-right: 10px;
`;

const OptionRow = styled.div<{ isLast: boolean; selected?: boolean }>`
  width: 100%;
  height: 35px;
  padding-left: 10px;
  display: flex;
  cursor: pointer;
  align-items: center;
  font-size: 13px;
  background: ${(props) => (props.selected ? "#ffffff11" : "")};

  :hover {
    background: #ffffff18;
  }
`;

const FilterCount = styled.div`
  padding: 5px;
  color: #ffffff;
  background: #ffffff11;
  margin-left: 7px;
  font-size: 12px;
  border-radius: 50px;
  margin-right: -5px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
`;

const Placeholder = styled.div`
  color: #aaaabb88;
  font-size: 12px;
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ScrollableWrapper = styled.div`
  overflow-y: auto;
  max-height: 350px;
`;

const Label = styled.div`
  height: 37px;
  display: flex;
  align-items: center;
  margin-left: 10px;
  font-size: 13px;
`;

const Option: any = styled.div`
  width: 100%;
  border-top: 1px solid #00000000;
  height: 37px;
  font-size: 13px;
  align-items: center;
  display: flex;
  align-items: center;
  padding-left: 15px;
  cursor: pointer;
  padding-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${(props: any) => (props.selected ? "#ffffff11" : "")};

  :hover {
    background: #ffffff22;
  }
`;

const Relative = styled.div`
  position: relative;
`;

const DropdownWrapper = styled.div`
  position: absolute;
  width: 100%;
  right: 0;
  z-index: 1;
  top: calc(100% + 5px);
`;

const Dropdown = styled.div`
  width: 260px;
  border-radius: 3px;
  z-index: 999;
  overflow-y: auto;
  background: #2f3135;
  padding: 0;
  border-radius: 5px;
  border: 1px solid #aaaabb33;
`;

const DropdownIcon = styled.img`
  width: 8px;
  margin-left: 12px;
`;

const FilterIcon = styled.img`
  width: 14px;
  margin-right: 9px;
`;

const StyledRadioFilter = styled.div<{ noMargin?: boolean }>`
  height: 30px;
  font-size: 13px;
  position: relative;
  padding: 10px;
  background: #26292e;
  border-radius: 5px;
  display: flex;
  align-items: center;
  margin-right: ${(props) => (props.noMargin ? "" : "10px")};
  cursor: pointer;
  border: 1px solid #494b4f;
  :hover {
    border: 1px solid #7a7b80;
  }
`;
