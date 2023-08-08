import React, { useEffect, useState, useContext, useMemo } from "react";
import styled from "styled-components";
import DashboardHeader from "../cluster-dashboard/DashboardHeader";
import semver from "semver";
import _ from "lodash";

import addOn from "assets/add-ons.png";
import notFound from "assets/not-found.png";

import { Context } from "shared/Context";
import api from "shared/api";
import { search } from "shared/search";

import TemplateList from "../launch/TemplateList";
import SearchBar from "components/porter/SearchBar";
import Spacer from "components/porter/Spacer";
import Loading from "components/Loading";
import ExpandedTemplate from "./ExpandedTemplate";
import ConfigureTemplate from "./ConfigureTemplate";
import Back from "components/porter/Back";
import Fieldset from "components/porter/Fieldset";
import Text from "components/porter/Text";
import Container from "components/porter/Container";

type Props = {
};

const HIDDEN_CHARTS = ["porter-agent", "loki"];
const DATA_STORES = ["elasticsearch", "mongodb", "postgresql", "mysql", "redis"];
const APPS = ["agent", "datadog", "tailscale-relay", "metabase", "mezmo"];
const POPULAR = ["datadog", "metabase", "postgresql"];
const NewAddOnFlow: React.FC<Props> = ({
}) => {
  const { capabilities, currentProject, currentCluster } = useContext(Context);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState("");
  const [addOnTemplates, setAddOnTemplates] = useState<any[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [currentForm, setCurrentForm] = useState<any>(null);


  const filteredTemplates = useMemo(() => {
    const filteredBySearch = search(
      addOnTemplates ?? [],
      searchValue,
      {
        keys: ["name"],
        isCaseSensitive: false,
      }
    );

    return _.sortBy(filteredBySearch);
  }, [addOnTemplates, searchValue]);

  const appTemplates = useMemo(() => {
    return filteredTemplates.filter(template => template.tags.includes("APP"));
  }, [filteredTemplates]);

  const dataStoreTemplates = useMemo(() => {
    return filteredTemplates.filter(template => template.tags.includes("DATA_STORE"));
  }, [filteredTemplates]);


  const getTemplates = async () => {
    setIsLoading(true);
    const default_addon_helm_repo_url = capabilities?.default_addon_helm_repo_url;
    try {
      const res = await api.getTemplates(
        "<token>",
        {
          repo_url: default_addon_helm_repo_url,
        },
        {
          project_id: currentProject.id,
        }
      );
      setIsLoading(false);
      var sortedVersionData = res.data.map((template: any) => {
        let versions = template.versions.reverse();
        versions = template.versions.sort(semver.rcompare);
        return {
          ...template,
          versions,
          currentVersion: versions[0],
        };
      });
      sortedVersionData.sort((a: any, b: any) => (a.name > b.name ? 1 : -1));
      sortedVersionData = sortedVersionData.filter(
        (template: any) => !HIDDEN_CHARTS.includes(template?.name)
      );
      sortedVersionData = sortedVersionData
        .filter(
          (template: any) =>
            DATA_STORES.includes(template?.name) ||
            APPS.includes(template?.name) ||
            POPULAR.includes(template?.name) // Include the POPULAR filter check
        )
        .map((template: any) => {
          let templateTags = [];

          if (DATA_STORES.includes(template.name)) {
            templateTags.push("DATA_STORE");
          }

          if (APPS.includes(template.name)) {
            templateTags.push("APP");
          }

          if (POPULAR.includes(template.name)) {
            templateTags.push("POPULAR"); // Here we add the POPULAR tag
          }

          return { ...template, tags: templateTags };
        });
      setAddOnTemplates(sortedVersionData);
    } catch (error) {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    getTemplates();
  }, [currentProject, currentCluster]);

  return (
    <StyledTemplateComponent>
      {
        (currentForm && currentTemplate) ? (
          <ConfigureTemplate
            currentTemplate={currentTemplate}
            currentForm={currentForm}
            goBack={() => setCurrentForm(null)}
          />
        ) : (
          <>
            <Back to="/addons" />
            <DashboardHeader
              image={addOn}
              title="Deploy a new add-on"
              capitalize={false}
              description="Select an add-on to deploy to this project."
              disableLineBreak

            />
            {
              currentTemplate ? (
                <ExpandedTemplate
                  currentTemplate={currentTemplate}
                  proceed={(form?: any) => setCurrentForm(form)}
                  goBack={() => setCurrentTemplate(null)}
                />
              ) : (
                <>
                  <SearchBar
                    value={searchValue}
                    setValue={setSearchValue}
                    placeholder="Search available add-ons . . ."
                    width="100%"
                  />
                  <Spacer y={1} />

                  {filteredTemplates.length === 0 && (
                    <Fieldset>
                      <Container row>
                        <PlaceholderIcon src={notFound} />
                        <Text color="helper">No matching add-ons were found.</Text>
                      </Container>
                    </Fieldset>
                  )}
                  {isLoading ? <Loading offset="-150px" /> : (
                    <>
                      <DarkMatter />

                      {appTemplates?.length > 0 &&
                        <>
                          <Spacer y={1.5} />
                          <div>
                            <Text color="#fff" size={15}>Apps and Services</Text>
                          </div>
                          <div>
                            <Text color="helper">For logging, metrics, etc.</Text>
                          </div>
                        </>}
                      <TemplateList
                        templates={appTemplates} // This is where you provide only APP templates
                        setCurrentTemplate={(x) => setCurrentTemplate(x)}
                      />
                      {dataStoreTemplates?.length > 0 &&
                        <>
                          <div>
                            <Text color="#fff" size={15}>Pre-Production Datastores</Text>
                          </div>
                          <div>
                            <Text color="helper">Datastore addons are NOT PRODUCTION GRADE. Use for dev environments ONLY.</Text>
                          </div>
                        </>}
                      <TemplateList
                        templates={dataStoreTemplates} // This is where you provide only DATA_STORE templates
                        setCurrentTemplate={(x) => setCurrentTemplate(x)}
                      />
                    </>
                  )}
                </>
              )
            }
          </>
        )
      }
    </StyledTemplateComponent >
  );
};

export default NewAddOnFlow;

const PlaceholderIcon = styled.img`
  height: 13px;
  margin-right: 12px;
  opacity: 0.65;
`;

const DarkMatter = styled.div`
  width: 100%;
  margin-top: -35px;
`;

const I = styled.i`
  font-size: 16px;
  padding: 4px;
  cursor: pointer;
  border-radius: 50%;
  margin-right: 15px;
  background: ${props => props.theme.fg};
  color: ${props => props.theme.text.primary};
  border: 1px solid ${props => props.theme.border};
  :hover {
    filter: brightness(150%);
  }
`;

const StyledTemplateComponent = styled.div`
  width: 100%;
  height: 100%;
`;