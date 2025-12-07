# Script Consolidation Validation Checklist

## Phase 1: Deletion Verification

- [ ] Verify no active processes reference deleted wrapper scripts
- [ ] Confirm all references updated in master scripts
- [ ] Test master_automation.ps1 runs without errors
- [ ] Test master_setup_local.ps1 runs without errors
- [ ] Test master_setup_simplified.ps1 runs without errors

## Phase 2: Consolidated Script Testing

- [ ] Test `scripts/testing/test_chatbot.ps1 -Mode Full`
- [ ] Test `scripts/testing/test_chatbot.ps1 -Mode Simple`
- [ ] Test `scripts/testing/test_chatbot.ps1 -Mode Quick -Message "test"`
- [ ] Verify all moved scripts execute from new locations

## Phase 3: Deployment Script Verification

- [ ] Test App Service deployment: `infrastructure/azure_deployment/deploy_all_services.ps1`
- [ ] Test Container Apps deployment: `infrastructure/azure_deployment/deploy_all_services_containerapp.ps1`
- [ ] Verify deleted azure_infrastructure deployment scripts are not referenced

## Phase 4: Documentation Verification

- [ ] Verify scripts/README.md is complete and accurate
- [ ] Verify all script paths in documentation are correct
- [ ] Verify migration guide paths are accurate
- [ ] Test following migration guide for common scenarios

## Phase 5: Integration Testing

- [ ] Run full automation pipeline: `master_automation.ps1`
- [ ] Run simplified setup: `master_setup_simplified.ps1`
- [ ] Run environment validation: `test_automation.ps1`
- [ ] Verify no broken script references in logs

