import React, { useContext, useState } from "react";
import {
  ArrayInputField,
  CheckboxField,
  CronField,
  FormField,
  InjectedProps,
  InputField,
  KeyValueArrayField,
  ResourceListField,
  Section,
  SelectField,
  ServiceIPListField,
  TextAreaField,
  UrlLinkField,
} from "./types";
import TabRegion, { TabOption } from "../TabRegion";
import Heading from "../form-components/Heading";
import Helper from "../form-components/Helper";
import Input from "./field-components/Input";
import { PorterFormContext } from "./PorterFormContextProvider";
import Checkbox from "./field-components/Checkbox";
import KeyValueArray from "./field-components/KeyValueArray";
import styled from "styled-components";
import SaveButton from "../SaveButton";
import ArrayInput from "./field-components/ArrayInput";
import Select from "./field-components/Select";
import ServiceIPList from "./field-components/ServiceIPList";
import ResourceList from "./field-components/ResourceList";
import VeleroForm from "./field-components/VeleroForm";
import CronInput from "./field-components/CronInput";
import TextAreaInput from "./field-components/TextAreaInput";
import UrlLink from "./field-components/UrlLink";

interface Props {
  leftTabOptions?: TabOption[];
  rightTabOptions?: TabOption[];
  renderTabContents?: (
    currentTab: string,
    submitValues?: any
  ) => React.ReactElement;
  saveButtonText?: string;
  isReadOnly?: boolean;
  isInModal?: boolean;
  color?: string;
  addendum?: any;
  saveValuesStatus?: string;
  showStateDebugger?: boolean;
  currentTab: string;
  setCurrentTab: (nt: string) => void;
  isLaunch?: boolean;
  hideSpacer?: boolean;
  // The tab to redirect to after saving the form
  redirectTabAfterSave?: string;
  injectedProps?: InjectedProps;

  absoluteSave: boolean;
}

const PorterForm: React.FC<Props> = (props) => {
  const {
    formData,
    latestData,
    isReadOnly,
    validationInfo,
    onSubmit,
    formState,
  } = useContext(PorterFormContext);

  const { currentTab, setCurrentTab } = props;
  const [showDiff, setShowDiff] = useState(false); // add this state for the checkbox

  const renderSectionField = (
    field: FormField,
    num?: number,
    i?: number
  ): JSX.Element => {
    const injected = props.injectedProps?.[field.type];
    const bundledProps = {
      ...field,
      isReadOnly,
      injectedProps: injected ?? {},
    };

    switch (field.type) {
      case "heading":
        // Remove top margin from heading if it's the first form element in the tab
        // TODO: Handle Job form and form variables more gracefully
        return (
          <Heading
            isAtTop={
              num + i < 1 ||
              (formData.name === "Job" && num + i === 1) ||
              (formData.name === "Worker" && num + i === 1)
            }
          >
            {field.label}
          </Heading>
        );
      case "subtitle":
        return <Helper>{field.label}</Helper>;
      case "input":
        return <Input {...(bundledProps as InputField)} />;
      case "checkbox":
        return <Checkbox {...(bundledProps as CheckboxField)} />;
      case "key-value-array":
        return <KeyValueArray {...(bundledProps as KeyValueArrayField)} />;
      case "array-input":
        return <ArrayInput {...(bundledProps as ArrayInputField)} />;
      case "select":
        return <Select {...(bundledProps as SelectField)} />;
      case "service-ip-list":
        return <ServiceIPList {...(bundledProps as ServiceIPListField)} />;
      case "resource-list":
        return <ResourceList {...(bundledProps as ResourceListField)} />;
      case "velero-create-backup":
        return <VeleroForm />;
      case "cron":
        return <CronInput {...(bundledProps as CronField)} />;
      case "text-area":
        return <TextAreaInput {...(bundledProps as TextAreaField)} />;
      case "url-link":
        return <UrlLink {...(bundledProps as UrlLinkField)} />;
    }
    return <p>Not Implemented: {(field as any).type}</p>;
  };

  const renderSection = (
    section: Section,
    num: number,
    latestData: Section,
    nums: number
  ): JSX.Element => {
    if (showDiff) {
      latestData.contents.forEach((obj, index) => {
        obj.id = obj.id + index;
      });

      return (
        <div style={{ display: "flex" }}>
          <div style={{ flex: 1 }}>
            {section.contents?.map((field, i) => (
              <React.Fragment key={field.id}>
                {renderSectionField(field, num, i)}
              </React.Fragment>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              marginLeft: "20px",
              borderLeft: "1px solid #ccc",
              paddingLeft: "20px",
            }}
          >
            {latestData.contents?.map((field, j) => (
              <React.Fragment key={field.id}>
                {renderSectionField(field, nums, j)}
              </React.Fragment>
            ))}
          </div>
          {isReadOnly && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                margin: "10px",
              }}
            >
              <label style={{ marginLeft: "10px" }}>
                Show diff view
                <input
                  type="checkbox"
                  checked={showDiff}
                  onChange={() => setShowDiff(!showDiff)}
                />
              </label>
            </div>
          )}
        </div>
      );
    } else {
      // Render a single section
      return (
        <>
          {isReadOnly && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                margin: "10px",
              }}
            >
              <label style={{ marginLeft: "10px" }}>
                Show diff view
                <input
                  type="checkbox"
                  checked={showDiff}
                  onChange={() => setShowDiff(!showDiff)}
                />
              </label>
            </div>
          )}
          {section.contents?.map((field, i) => {
            return (
              <React.Fragment key={field.id}>
                {renderSectionField(field, num, i)}
              </React.Fragment>
            );
          })}
        </>
      );
    }
  };

  const getTabOptions = (): TabOption[] => {
    let options = (props.leftTabOptions || [])
      .concat(
        formData?.tabs?.map((tab) => {
          if (props.isLaunch && tab?.settings?.omitFromLaunch) {
            return undefined;
          }
          return { label: tab.label, value: tab.name };
        })
      )
      .concat(props.rightTabOptions || []);
    return options.filter((x) => !!x);
  };

  const showSaveButton = (): boolean => {
    if (props.isReadOnly) {
      return false;
    }

    let returnVal = true;
    props.leftTabOptions?.forEach((tab: any) => {
      if (tab.value === currentTab) {
        returnVal = false;
      }
    });
    props.rightTabOptions?.forEach((tab: any) => {
      if (tab.value === currentTab) {
        returnVal = false;
      }
    });

    return returnVal;
  };

  const renderTab = (): JSX.Element => {
    if (!formData) {
      return props.renderTabContents(currentTab);
    }

    const tab = formData.tabs?.filter((tab) => tab.name == currentTab)[0];
    const tabby = latestData.tabs?.filter((tab) => tab.name == currentTab)[0];

    // Handle external tab
    if (!tab) {
      return props.renderTabContents ? (
        props.renderTabContents(currentTab)
      ) : (
        <></>
      );
    }

    return (
      <StyledPorterForm showSave={showSaveButton()}>
        {tab.sections?.map((section, i) => {
          const latestSection = tabby?.sections?.find(
            (s) => s.name === section.name
          );
          return (
            <React.Fragment key={section.name}>
              {renderSection(section, i, latestSection, i)}
            </React.Fragment>
          );
        })}
      </StyledPorterForm>
    );
  };

  const isDisabled = () => {
    if (props.saveValuesStatus == "loading") {
      return true;
    }

    return isReadOnly || !validationInfo.validated;
  };

  const renderSaveStatus = (): string => {
    if (isDisabled() && props.saveValuesStatus !== "loading") {
      return "Missing required fields";
    }
    return props.saveValuesStatus;
  };

  const submit = () => {
    onSubmit(() => {
      if (props.redirectTabAfterSave != "") {
        setCurrentTab(props.redirectTabAfterSave);
      }
    });
  };

  return (
    <>
      <TabRegion
        addendum={props.addendum}
        color={props.color}
        options={getTabOptions()}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        suppressAnimation={true}
        showDiff={showDiff}
      >
        {renderTab()}
      </TabRegion>
      <br />
      {showSaveButton() && (
        <SaveButton
          text={props.saveButtonText || "Deploy app"}
          onClick={submit}
          absoluteSave={props.absoluteSave}
          clearPosition={true}
          makeFlush={!props.isInModal}
          status={
            validationInfo.validated ? renderSaveStatus() : validationInfo.error
          }
          statusPosition="right"
          disabled={isDisabled()}
        />
      )}
      {props.showStateDebugger && (
        <Pre>{JSON.stringify(formState, undefined, 2)}</Pre>
      )}
      {!props.hideSpacer && <Spacer />}
    </>
  );
};

export default PorterForm;

const Pre = styled.pre`
  font-size: 13px;
  color: #aaaabb;
`;

const Spacer = styled.div`
  height: 50px;
`;

const StyledPorterForm = styled.div<{ showSave?: boolean }>`
  width: 100%;
  height: ${(props) => (props.showSave ? "calc(100% - 50px)" : "100%")};
  color: #ffffff;
  position: relative;
  border-radius: 8px;
  font-size: 13px;
  overflow: auto;
  padding: 30px;
  margin-bottom: 5px;
  font-size: 13px;
  border-radius: 5px;
  background: #26292e;
  border: 1px solid #494b4f;
`;
