package com.kosign.vbiz.architecture;

import static org.assertj.core.api.Assertions.assertThat;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import java.lang.reflect.Method;
import java.util.Arrays;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;

/** Structural rules from CLAUDE.md and ARCHITECTURE.md. */
class ArchitectureTest {

    private static final String ROOT = "com.kosign.vbiz";

    private static JavaClasses imported;

    @BeforeAll
    static void importClasses() {
        imported = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages(ROOT);
    }

    @Test
    void controllers_must_not_depend_on_repositories() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..controller..")
                .should().dependOnClassesThat().resideInAPackage("..repository..")
                .because("controllers call services; services own data access (CLAUDE.md)");
        rule.check(imported);
    }

    @Test
    void common_must_not_depend_on_domains() {
        ArchRule rule = noClasses()
                .that().resideInAPackage(ROOT + ".common..")
                .should().dependOnClassesThat().resideOutsideOfPackages(
                        ROOT + ".common..", "java..", "javax..", "jakarta..",
                        "org.springframework..", "org.hibernate..", "org.slf4j..",
                        "com.fasterxml..", "lombok..", "com.nimbusds..")
                .because("vbiz-common is cross-cutting and must not know about any domain");
        rule.check(imported);
    }

    /** CLAUDE.md "Stock": online orders, POS and adjustments change stock only through the writer. */
    @Test
    void only_the_inventory_stock_writer_changes_stock() {
        ArchRule rule = noClasses()
                .that().doNotHaveFullyQualifiedName(ROOT + ".inventory.service.StockWriter")
                .should().callMethod(ProductVariant.class, "adjustStock", int.class)
                .because("every stock change must append a movement in the same transaction (StockWriter)");
        rule.check(imported);
    }

    /** Only the inventory package writes the movement log (orders and the POS go through StockWriter). */
    @Test
    void only_inventory_touches_the_movement_log() {
        ArchRule rule = noClasses()
                .that().resideOutsideOfPackage(ROOT + ".inventory..")
                .should().dependOnClassesThat().haveFullyQualifiedName(
                        ROOT + ".inventory.repository.StockMovementRepository")
                .orShould().callConstructor(com.kosign.vbiz.inventory.domain.StockMovement.class)
                .because("stock changes are appended by inventory.service.StockWriter only (CLAUDE.md \"Stock\")");
        rule.check(imported);
    }

    /** Order, cart and payment code never lock or edit variant stock themselves. */
    @Test
    void order_cart_and_payment_do_not_lock_variants_for_stock() {
        ArchRule rule = noClasses()
                .that().resideInAnyPackage(ROOT + ".order..", ROOT + ".cart..", ROOT + ".payment..")
                .should().callMethod(com.kosign.vbiz.catalog.repository.ProductVariantRepository.class,
                        "lockForStock", java.util.UUID.class, java.util.UUID.class)
                .because("the stock writer serialises stock changes on the variant row");
        rule.check(imported);
    }

    /** The payment domain knows nothing about orders (orders listen to its events). */
    @Test
    void payment_does_not_depend_on_order() {
        ArchRule rule = noClasses()
                .that().resideInAPackage(ROOT + ".payment..")
                .should().dependOnClassesThat().resideInAPackage(ROOT + ".order..");
        rule.check(imported);
    }

    @Test
    void variant_stock_has_no_setter() {
        assertThat(Arrays.stream(ProductVariant.class.getMethods()).map(Method::getName))
                .doesNotContain("setStock");
    }

    @Test
    void controllers_extend_BaseController() {
        ArchRule rule = classes()
                .that().resideInAPackage("..controller..")
                .and().haveSimpleNameEndingWith("Controller")
                .should().beAssignableTo(com.kosign.vbiz.common.api.BaseController.class);
        rule.check(imported);
    }
}
